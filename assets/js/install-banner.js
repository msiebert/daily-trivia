(function () {
  var DISMISS_KEY = "daily-trivia-install-banner-dismissed";
  var deferredPrompt = null;

  function isIosSafari() {
    var ua = window.navigator.userAgent;
    var isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIos && isSafari;
  }

  function isStandalone() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches
    );
  }

  function dismissed() {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch (e) {
      // localStorage unavailable (private mode, etc.) — banner just won't persist dismissal
    }
  }

  // Chrome (desktop + Android) fires this instead of showing its own
  // automatic prompt — we have to capture it and trigger .prompt() from
  // our own UI, or the only way to install is digging through the menu.
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showBanner("chrome");
  });

  window.addEventListener("appinstalled", function () {
    hideBanner();
    dismiss();
  });

  var banner, copyEl, actionButton, dismissButton, wired;

  function showBanner(mode) {
    if (isStandalone() || dismissed()) return;
    if (!wired) wireBanner();
    if (!banner) return;

    if (mode === "ios") {
      copyEl.innerHTML = "Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.";
      actionButton.hidden = true;
    } else {
      copyEl.textContent = "Add it to your home screen for quick access.";
      actionButton.hidden = false;
    }

    banner.classList.add("is-visible");
  }

  function hideBanner() {
    if (banner) banner.classList.remove("is-visible");
  }

  function wireBanner() {
    wired = true;
    banner = document.querySelector(".install-banner");
    if (!banner) return;

    copyEl = banner.querySelector(".install-banner-copy");
    actionButton = banner.querySelector(".install-banner-action");
    dismissButton = banner.querySelector(".install-banner-dismiss");

    if (actionButton) {
      actionButton.addEventListener("click", function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
          hideBanner();
        });
      });
    }

    if (dismissButton) {
      dismissButton.addEventListener("click", function () {
        hideBanner();
        dismiss();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (isIosSafari()) showBanner("ios");
  });
})();
