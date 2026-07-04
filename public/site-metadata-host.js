(function () {
  var defaultOrigin = "https://active-etf.chicoo.co";
  var allowedHosts = [
    "active-etf.chicoo.co",
    "chicoo.co",
    "www.chicoo.co",
    "active-etf.inthewins.com",
    "inthewins.com",
    "www.inthewins.com"
  ];
  var canonicalHostByHost = {
    "active-etf.chicoo.co": "active-etf.chicoo.co",
    "chicoo.co": "active-etf.chicoo.co",
    "www.chicoo.co": "active-etf.chicoo.co",
    "active-etf.inthewins.com": "active-etf.inthewins.com",
    "inthewins.com": "active-etf.inthewins.com",
    "www.inthewins.com": "active-etf.inthewins.com"
  };
  var hostname = window.location.hostname.toLowerCase();
  var origin = allowedHosts.indexOf(hostname) >= 0 ? "https://" + (canonicalHostByHost[hostname] || hostname) : defaultOrigin;

  if (origin === defaultOrigin) return;

  function replaceOrigin(value) {
    return value && value.indexOf(defaultOrigin) >= 0 ? value.split(defaultOrigin).join(origin) : value;
  }

  document.querySelectorAll("link[href]").forEach(function (element) {
    element.setAttribute("href", replaceOrigin(element.getAttribute("href")));
  });

  document.querySelectorAll("meta[content]").forEach(function (element) {
    element.setAttribute("content", replaceOrigin(element.getAttribute("content")));
  });

  document.querySelectorAll('script[type="application/ld+json"]').forEach(function (element) {
    element.textContent = replaceOrigin(element.textContent);
  });
})();
