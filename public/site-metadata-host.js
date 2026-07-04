(function () {
  var defaultOrigin = "https://active-etf.chicoo.co";
  var allowedHosts = ["active-etf.chicoo.co", "chicoo.co", "www.chicoo.co", "inthewins.com", "www.inthewins.com"];
  var hostname = window.location.hostname.toLowerCase();
  var origin = allowedHosts.indexOf(hostname) >= 0 ? window.location.origin.replace(/\/+$/u, "") : defaultOrigin;

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
