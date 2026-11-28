export function addAnalyticsScripts() {
  let googleTag = document.createElement('script');
  googleTag.async = true;
  googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=G-KVQWWGS9YF';
  let googleAnalytics = document.createElement('script');
  googleAnalytics.type = 'text/javascript';
  googleAnalytics.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());

        gtag('config', 'G-KVQWWGS9YF');
    `;
  let clarity = document.createElement('script');
  clarity.type = 'text/javascript';
  clarity.innerHTML = `
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", "i45ibpoqjq");
   `;
  document.head.appendChild(googleTag);
  document.head.appendChild(googleAnalytics);
  document.head.appendChild(clarity);
}
