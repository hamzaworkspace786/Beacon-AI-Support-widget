/*
 * Beacon widget loader.
 *
 * A business adds this to its website:
 *   <script src="https://YOUR-BEACON-ADDRESS/widget.js" data-bot="bot_..." async></script>
 *
 * It does four things and has no dependencies:
 *   1. Asks Beacon for the bot's look (name, color) and whether it may show on this site.
 *   2. Draws a chat bubble in a shadow root, so the website's CSS can't change it
 *      and it can't change the website's.
 *   3. Opens the chat in an iframe served by Beacon (/embed/...). The chat's code and
 *      styles never run inside the customer's page.
 *   4. Closes when asked by the chat window, or when Escape is pressed.
 *
 * Optional: data-position="left" puts the bubble on the left. After it loads,
 * window.BeaconWidget has open(), close() and destroy().
 */
(function () {
  "use strict";

  if (window.__beaconWidgetLoaded) return;

  var script =
    document.currentScript || document.querySelector('script[data-bot][src*="widget.js"]');
  if (!script) return;

  var botId = script.getAttribute("data-bot");
  if (!botId || !/^bot_[0-9a-f]{20}$/.test(botId)) {
    console.warn("[Beacon] The widget script needs a valid data-bot attribute.");
    return;
  }

  var origin;
  try {
    // The widget talks to the same place the script was loaded from.
    origin = new URL(script.src).origin;
  } catch (error) {
    return;
  }

  var onLeft = script.getAttribute("data-position") === "left";
  window.__beaconWidgetLoaded = true;

  // Pick dark or white icon color for a background, the same way the dashboard does.
  function textColorFor(hex) {
    var match = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!match) return "#ffffff";
    var n = parseInt(match[1], 16);
    function channel(value) {
      var s = value / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    var luminance =
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255);
    var contrastWithDark = (luminance + 0.05) / (0.0083 + 0.05);
    var contrastWithLight = 1.05 / (luminance + 0.05);
    return contrastWithDark >= contrastWithLight ? "#0f1722" : "#ffffff";
  }

  var ICON_CHAT =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13v-1a9 9 0 0 1 18 0v1"/><path d="M5 12h1v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm14 0h-1v7h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z"/><path d="M18 19h-1.5a4.5 4.5 0 0 1-4.5 4.5H11"/></svg>';
  var ICON_CLOSE =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var STYLES =
    ":host{all:initial}" +
    ".btn{position:fixed;bottom:20px;" + (onLeft ? "left" : "right") + ":20px;width:56px;height:56px;border-radius:50%;border:0;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s ease;z-index:2}" +
    ".btn:hover{transform:scale(1.06)}" +
    ".btn:focus-visible{outline:3px solid #ffffff;outline-offset:2px;box-shadow:0 0 0 6px rgba(15,23,34,.55)}" +
    ".frame{position:fixed;bottom:88px;" + (onLeft ? "left" : "right") + ":20px;width:380px;height:min(640px,calc(100% - 108px));border:0;border-radius:16px;background:#ffffff;box-shadow:0 12px 40px rgba(0,0,0,.28);opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;visibility:hidden;transition:opacity .18s ease,transform .18s ease,visibility .18s;z-index:1}" +
    ".frame.open{opacity:1;transform:none;pointer-events:auto;visibility:visible}" +
    "@media (max-width:480px){.frame{top:0;left:0;right:0;bottom:0;width:100%;height:100%;height:100dvh;border-radius:0;z-index:3}}" +
    "@media (prefers-reduced-motion:reduce){.btn,.frame{transition:none}}";

  var host = null;
  var button = null;
  var frame = null;
  var open = false;
  var config = null;

  function ensureFrame() {
    if (frame) return frame;
    frame = document.createElement("iframe");
    frame.className = "frame";
    frame.title = (config && config.name ? config.name : "Support") + " chat";
    frame.src = origin + "/embed/" + botId;
    // Beacon checks the Referer of this request to learn which website is showing the
    // chat. "origin" sends just the website's address (never the page), and does it
    // even if the website's own policy would send nothing.
    frame.referrerPolicy = "origin";
    // The chat window needs nothing from the browser except its own storage.
    frame.setAttribute("allow", "");
    host.shadowRoot.appendChild(frame);
    return frame;
  }

  function setOpen(next) {
    if (!host) return;
    open = next;
    var element = ensureFrame();
    if (next) {
      // Let the browser draw the closed state first, so the opening animates.
      requestAnimationFrame(function () {
        element.classList.add("open");
      });
    } else {
      element.classList.remove("open");
    }
    button.innerHTML = next ? ICON_CLOSE : ICON_CHAT;
    button.setAttribute("aria-expanded", next ? "true" : "false");
    button.setAttribute("aria-label", next ? "Close chat" : "Open chat");
  }

  function onMessage(event) {
    // Only the chat window we created, from Beacon's own address, may speak to us.
    if (event.origin !== origin) return;
    if (!frame || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || data.source !== "beacon") return;
    if (data.type === "close") setOpen(false);
  }

  function onKeydown(event) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      if (button) button.focus();
    }
  }

  function build() {
    host = document.createElement("div");
    host.setAttribute("data-beacon-widget", botId);
    host.style.cssText = "all:initial;position:fixed;z-index:2147483000;";
    var root = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);

    var color = /^#[0-9a-f]{6}$/i.test(config.color) ? config.color : "#4f46e5";
    button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.style.background = color;
    button.style.color = textColorFor(color);
    button.innerHTML = ICON_CHAT;
    button.setAttribute("aria-label", "Open chat");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", function () {
      setOpen(!open);
    });
    root.appendChild(button);

    document.body.appendChild(host);
    window.addEventListener("message", onMessage);
    document.addEventListener("keydown", onKeydown);
  }

  function destroy() {
    window.removeEventListener("message", onMessage);
    document.removeEventListener("keydown", onKeydown);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = button = frame = null;
    open = false;
    window.__beaconWidgetLoaded = false;
    delete window.BeaconWidget;
  }

  function start() {
    fetch(origin + "/api/widget/" + botId + "/config")
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        // Nothing is drawn unless Beacon says this bot may show on this website.
        if (!data || !data.enabled) {
          window.__beaconWidgetLoaded = false;
          return;
        }
        config = data;
        build();
        window.BeaconWidget = {
          open: function () {
            setOpen(true);
          },
          close: function () {
            setOpen(false);
          },
          destroy: destroy,
        };
      })
      .catch(function () {
        window.__beaconWidgetLoaded = false;
      });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
