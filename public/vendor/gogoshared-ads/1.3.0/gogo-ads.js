/* GogoShared Scene Ads SDK 1.3.0. Explicit destination clicks; no telemetry or credentials. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GogoAds = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.3.0', MAX_JSON = 262144, MAX_IMAGE = 33554432;
  const BASE = 'https://gogoshared.z23.web.core.windows.net/games/shared/ads/';
  const SHARED_ID = 'shared-webp', SHARED_PATH = 'projects/shared-webp/config.json';
  const LEGACY_SHARED_PATH = 'projects/shared-default/config.json';
  const id = v => typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(v);
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const CLICK_ORIGINS = new Set(['https://game.h8.com.tw','https://www.h8.com.tw']);
  function validateClickUrl(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x20\x7f\\]/.test(value) || !value.startsWith('https://')) throw Error('Invalid click URL');
    const u = new URL(value);
    if (!CLICK_ORIGINS.has(u.origin) || u.username || u.password) throw Error('Click URL outside approved destinations');
    return u.href;
  }
  function imageType(bytes) {
    const b=new Uint8Array(bytes); if(b.length>MAX_IMAGE)throw Error('Image too large');
    if(b.length>=24&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'png';
    if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'jpeg';
    if(b.length>=20&&String.fromCharCode(...b.subarray(0,4))==='RIFF'&&String.fromCharCode(...b.subarray(8,12))==='WEBP') {
      const v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(v.getUint32(4,true)+8!==b.length)throw Error('Invalid WebP RIFF length');
      for(let n=12;n+8<=b.length;){const tag=String.fromCharCode(...b.subarray(n,n+4)),size=v.getUint32(n+4,true);if(n+8+size>b.length)throw Error('Truncated WebP chunk');if(tag==='ANIM'||tag==='ANMF'||tag==='VP8X'&&size>=1&&(b[n+8]&2))throw Error('Animated advertisements are not supported');n+=8+size+(size&1);}
      return 'webp';
    }
    throw Error('Supported image formats: PNG, JPEG, WebP');
  }
  function atlasDescriptor(catalog,preferWebP=true){return catalog.atlas.variants?.find(v=>preferWebP?v.format==='webp':v.format==='png'||v.format==='jpeg')||catalog.atlas;}
  function https(value, base) {
    const u = new URL(value, base);
    if (u.protocol !== 'https:' || u.username || u.password || u.origin !== new URL(base).origin || !u.pathname.startsWith(new URL(base).pathname)) throw Error('URL outside approved asset root');
    return u.href;
  }
  function validateCatalog(c, base = BASE) {
    if (!c || c.schemaVersion !== 1 || !id(c.catalogId) || !id(c.revision) || !Array.isArray(c.groups) || !c.groups.length || c.groups.length > 32 || !Array.isArray(c.creatives) || c.creatives.length > 256) throw Error('Invalid catalog');
    const groups = new Set();
    for (const g of c.groups) {
      if (!id(g.id) || groups.has(g.id) || typeof g.label !== 'string' || g.label.length > 128 || typeof g.preferAspect !== 'boolean') throw Error('Invalid group');
      groups.add(g.id);
    }
    const a = c.atlas;
    if (!a || !Number.isInteger(a.width) || !Number.isInteger(a.height) || a.width < 1 || a.height < 1 || a.width > 8192 || a.height > 8192 || a.width * a.height > 16777216 || !/^[a-f0-9]{64}$/.test(a.sha256)) throw Error('Invalid atlas');
    https(a.url, base);
    if(a.format!==undefined&&!['png','jpeg','webp'].includes(a.format))throw Error('Invalid atlas format');
    if(a.variants!==undefined){if(!Array.isArray(a.variants)||a.variants.length>3)throw Error('Invalid atlas variants');const formats=new Set();for(const v of a.variants){if(!v||!['png','jpeg','webp'].includes(v.format)||formats.has(v.format)||!/^[a-f0-9]{64}$/.test(v.sha256))throw Error('Invalid atlas variant');formats.add(v.format);https(v.url,base);}}
    const ids = new Set();
    for (const x of c.creatives) {
      if (!id(x.id) || ids.has(x.id) || !groups.has(x.group) || typeof x.enabled !== 'boolean' || ![x.x,x.y,x.width,x.height,x.aspect].every(finite) || x.x < 0 || x.y < 0 || x.width <= 0 || x.height <= 0 || x.x+x.width > 1.0000001 || x.y+x.height > 1.0000001 || x.aspect < .1 || x.aspect > 10 || Math.abs(x.width*a.width/(x.height*a.height)/x.aspect-1) > .02) throw Error('Invalid creative: ' + x.id);
      ids.add(x.id);
      validateClickUrl(x.clickUrl);
    }
    return c;
  }
  function validateConfig(c, project, base = BASE) {
    if (!c || c.schemaVersion !== 1 || !id(c.projectId) || c.projectId !== project || !id(c.revision) || typeof c.enabled !== 'boolean' || typeof c.defaultEnabled !== 'boolean' || typeof c.defaultCollection !== 'string' || (c.defaultCollection !== 'all' && !id(c.defaultCollection)) || !/^[a-f0-9]{64}$/.test(c.catalogSha256)) throw Error('Invalid project config');
    https(c.catalogUrl, base); return c;
  }
  function select(catalog, index, collection = 'all', wide = false) {
    if (!Number.isSafeInteger(index)) throw Error('Index must be a safe integer');
    let list = catalog.creatives.filter(c => c.enabled && (collection === 'all' || c.group === collection));
    const group = catalog.groups.find(g => g.id === collection);
    if (group && group.preferAspect) {
      const shaped = list.filter(c => wide ? c.aspect > 1.3 : c.aspect <= 1.3);
      if (shaped.length) list = shaped;
    }
    return list.length ? list[Math.abs(index) % list.length] : null;
  }
  function fit(width, height, aspect) {
    if (![width,height,aspect].every(finite) || width <= 0 || height <= 0 || aspect <= 0) throw Error('Invalid panel dimensions');
    const w = Math.min(width,height*aspect), h = w/aspect;
    return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
  }
  async function sha(bytes) {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function request(url, max, timeout) {
    const abort = new AbortController(), timer = setTimeout(()=>abort.abort(),timeout);
    try {
      const res = await fetch(url, {signal:abort.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if (!res.ok) throw Error('HTTP '+res.status);
      if (Number(res.headers.get('content-length')) > max) throw Error('Response too large');
      const reader = res.body.getReader(), chunks=[]; let n=0;
      for (;;) { const v=await reader.read(); if(v.done)break; n+=v.value.length; if(n>max){await reader.cancel();throw Error('Response too large');} chunks.push(v.value); }
      const bytes=new Uint8Array(n);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.length;}return bytes;
    } finally {clearTimeout(timer);}
  }
  class Client {
    constructor({projectId,configUrl,configProjectId,baseUrl=BASE,fallback=null,storage,timeoutMs=8000,preferWebP=true,onError=()=>{}}) {
      if (!id(projectId)) throw Error('Invalid projectId');
      this.projectId=projectId;this.base=baseUrl;this.configUrl=https(configUrl||SHARED_PATH,baseUrl);
      const sharedURL=new URL(SHARED_PATH,baseUrl);
      const path=new URL(this.configUrl).pathname;
      this.configProjectId=configProjectId??(path===sharedURL.pathname?SHARED_ID:path===new URL(LEGACY_SHARED_PATH,baseUrl).pathname?'shared-default':projectId);
      if(!id(this.configProjectId))throw Error('Invalid configProjectId');
      this.timeout=Math.max(1000,Math.min(timeoutMs,30000));this.fallback=fallback;this.onError=onError;
      this.preferWebP=preferWebP;this.imageFormat=null;this.imageUrl=null;
      this.catalog=null;this.config=null;this.image=null;this.generation=0;this.disposed=false;this.listeners=new Set();
      this.frames=new WeakMap();this.bindings=new Set();
      try { this.storage=storage === undefined ? localStorage : storage; } catch (_) {this.storage=null;}
      this.pref={};try {this.pref=JSON.parse(this.storage?.getItem('gogo.ads.'+projectId)||'{}');}catch (_) {}
      this.status='empty';
    }
    get enabled(){return !!this.config && this.config.enabled && (typeof this.pref.enabled==='boolean'?this.pref.enabled:this.config.defaultEnabled);}
    get collection(){const v=this.pref.collection || this.config?.defaultCollection || 'all';return v==='all'||this.catalog?.groups.some(g=>g.id===v)?v:'all';}
    setEnabled(value){this.pref.enabled=!!value;this.persist();}
    setCollection(value){if(value!=='all'&&!this.catalog?.groups.some(g=>g.id===value))throw Error('Unknown collection');this.pref.collection=value;this.persist();}
    persist(){try{this.storage?.setItem('gogo.ads.'+this.projectId,JSON.stringify(this.pref));}catch(_){}this.emit();}
    subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
    emit(){for(const fn of this.listeners)fn(this);}
    async prepare(config,catalogBytes,imageBytes,descriptor=null) {
      validateConfig(config,this.configProjectId,this.base);
      if(await sha(catalogBytes)!==config.catalogSha256)throw Error('Catalog hash mismatch');
      const catalog=validateCatalog(JSON.parse(new TextDecoder().decode(catalogBytes)),this.base);
      if(config.defaultCollection!=='all'&&!catalog.groups.some(g=>g.id===config.defaultCollection))throw Error('Unknown default collection');
      const a=descriptor||catalog.atlas;
      if(![catalog.atlas,...(catalog.atlas.variants||[])].some(v=>v.url===a.url&&v.sha256===a.sha256))throw Error('Atlas descriptor is not in verified catalog');
      if(await sha(imageBytes)!==a.sha256)throw Error('Atlas hash mismatch');
      const type=imageType(imageBytes);if(a.format&&a.format!==type)throw Error('Image format does not match catalog');
      const image=await createImageBitmap(new Blob([imageBytes],{type:'image/'+type}));
      if(image.width!==catalog.atlas.width||image.height!==catalog.atlas.height){image.close();throw Error('Atlas dimensions mismatch');}
      return {config,catalog,image,imageFormat:type,imageUrl:a.url};
    }
    async load() {
      if(this.disposed)throw Error('Client disposed');
      const gen=++this.generation;
      let next, source='remote';
      try {
        const pointer=new URL(this.configUrl);pointer.searchParams.set('_ads',Date.now()+'-'+gen);
        const config=validateConfig(JSON.parse(new TextDecoder().decode(await request(pointer.href,MAX_JSON,this.timeout))),this.configProjectId,this.base);
        const catBytes=await request(https(config.catalogUrl,this.base),MAX_JSON,this.timeout);
        if(await sha(catBytes)!==config.catalogSha256)throw Error('Catalog hash mismatch');
        const cat=validateCatalog(JSON.parse(new TextDecoder().decode(catBytes)),this.base);
        const a=atlasDescriptor(cat,this.preferWebP);
        try{next=await this.prepare(config,catBytes,await request(https(a.url,this.base),MAX_IMAGE,this.timeout),a);}
        catch(e){const fallback=[cat.atlas,...(cat.atlas.variants||[])].find(v=>v.url!==a.url&&v.format!=='webp');if(!fallback)throw e;this.onError(e);next=await this.prepare(config,catBytes,await request(https(fallback.url,this.base),MAX_IMAGE,this.timeout),fallback);}
      } catch(error) {
        this.onError(error);
        if(this.image){this.status='last-good';this.emit();return false;}
        if(!this.fallback){this.status='unavailable';this.emit();return false;}
        source='fallback';
        try {next=await this.prepare(this.fallback.config,this.fallback.catalogBytes,this.fallback.imageBytes);}
        catch(e){this.onError(e);this.status='unavailable';this.emit();return false;}
      }
      if(gen!==this.generation||this.disposed){next.image.close();return false;}
      this.image?.close();Object.assign(this,next);this.status=source;this.emit();return true;
    }
    getClickUrl(index=0,wide=false){if(this.disposed||!this.enabled||!this.image||!this.catalog)return null;return validateClickUrl(select(this.catalog,index,this.collection,wide)?.clickUrl);}
    openClickUrl(index=0,wide=false){return this.openDestination(this.getClickUrl(index,wide));}
    openDestination(url){
      if(this.disposed||!this.enabled||!url||typeof window==='undefined'||globalThis.navigator?.userActivation?.isActive===false)return false;
      // Called synchronously from the host's explicit input handler. No click reporting request.
      window.open(validateClickUrl(url),'_blank','noopener,noreferrer');return true;
    }
    frameUrl(canvas){
      const f=this.frames.get(canvas);
      if(!f||this.disposed||!this.enabled||f.image!==this.image||f.catalog!==this.catalog||f.width!==canvas.width||f.height!==canvas.height||select(this.catalog,f.index,this.collection,f.wide)!==f.creative)return null;
      return validateClickUrl(f.creative.clickUrl);
    }
    bindClick(canvas){
      if(this.disposed)throw Error('Client disposed');
      // One binding per canvas; drawing always records the creative actually displayed.
      for(const b of this.bindings)if(b.canvas===canvas)b.dispose();
      const original={role:canvas.getAttribute('role'),tabindex:canvas.getAttribute('tabindex'),label:canvas.getAttribute('aria-label'),cursor:canvas.style.cursor};
      const sync=()=>{const url=this.frameUrl(canvas);if(url){canvas.setAttribute('role','link');canvas.setAttribute('tabindex','0');canvas.setAttribute('aria-label','開啟廣告目標頁（新分頁）');}else{canvas.removeAttribute('role');canvas.setAttribute('tabindex','-1');canvas.removeAttribute('aria-label');canvas.style.cursor=original.cursor;}};
      const hit=e=>{const url=this.frameUrl(canvas),f=this.frames.get(canvas),r=canvas.getBoundingClientRect();if(!url||!r.width||!r.height)return null;const x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height;return x>=f.fit.x&&x<=f.fit.x+f.fit.width&&y>=f.fit.y&&y<=f.fit.y+f.fit.height?url:null;};
      const click=e=>{if(e.isTrusted&&e.button===0){const url=hit(e);if(url){e.preventDefault();this.openDestination(url);}}};
      const key=e=>{if(e.isTrusted&&e.key==='Enter'&&!e.repeat){const url=this.frameUrl(canvas);if(url){e.preventDefault();this.openDestination(url);}}};
      const move=e=>{canvas.style.cursor=hit(e)?'pointer':original.cursor;},leave=()=>{canvas.style.cursor=original.cursor;};
      canvas.addEventListener('click',click);canvas.addEventListener('keydown',key);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);
      let active=true;const unsubscribe=this.subscribe(sync);
      const binding={canvas,sync,dispose:()=>{if(!active)return;active=false;unsubscribe();canvas.removeEventListener('click',click);canvas.removeEventListener('keydown',key);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);for(const [attr,value] of [['role',original.role],['tabindex',original.tabindex],['aria-label',original.label]]){if(value===null)canvas.removeAttribute(attr);else canvas.setAttribute(attr,value);}canvas.style.cursor=original.cursor;this.bindings.delete(binding);}};
      this.bindings.add(binding);sync();return binding.dispose;
    }
    draw(canvas,index=0){
      const ctx=canvas.getContext('2d');this.frames.delete(canvas);ctx.clearRect(0,0,canvas.width,canvas.height);
      let creative=null;
      if(!this.disposed&&this.enabled&&this.image&&this.catalog){const wide=canvas.width/canvas.height>1.3;creative=select(this.catalog,index,this.collection,wide);if(creative){const f=fit(canvas.width,canvas.height,creative.aspect),a=this.catalog.atlas,c=creative;ctx.drawImage(this.image,c.x*a.width,(1-c.y-c.height)*a.height,c.width*a.width,c.height*a.height,f.x,f.y,f.width,f.height);this.frames.set(canvas,{creative,index,wide,fit:f,image:this.image,catalog:this.catalog,width:canvas.width,height:canvas.height});}}
      for(const b of this.bindings)if(b.canvas===canvas)b.sync();return creative?.id||null;
    }
    dispose(){this.disposed=true;++this.generation;for(const b of this.bindings)b.dispose();this.image?.close();this.image=null;this.listeners.clear();}
  }
  return {version:VERSION,baseUrl:BASE,sharedConfigUrl:BASE+SHARED_PATH,sharedConfigProjectId:SHARED_ID,validateCatalog,validateConfig,validateClickUrl,imageType,atlasDescriptor,select,fit,Client};
});
