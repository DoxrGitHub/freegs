// ==UserScript==
// @name         FREEGS Auto-Claimer
// @version      1.0
// @description  Auto-click FREEGS purchase links to save time
// @match        https://store.epicgames.com/purchase?link_generated_by=freegs*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const param = new URLSearchParams(location.search).get("link_generated_by");
    if (param === "freegs") {
        document.body.click();

        const tryClick = () => {
            const btn = document.querySelector("#purchase-app > div > div > div > div.payment-summaries > div.payment-confirm-container > div > button");
            if (btn) btn.click(); 
            else setTimeout(tryClick, 1000); // in case it don't exist yet
        };
        tryClick();
    }
})();
