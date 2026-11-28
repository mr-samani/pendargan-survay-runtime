var app = window.app || {};
/* SIMPLE EVENT BUS *****************************************/
app.event = (function () {
  var _callbacks = {};

  var on = function (eventName, callback) {
    if (!_callbacks[eventName]) {
      _callbacks[eventName] = [];
    }

    _callbacks[eventName].push(callback);
  };

  var off = function (eventName) {
    var callbacks = _callbacks[eventName];
    if (!callbacks) {
      return;
    }
    delete _callbacks[eventName];
  };

  var trigger = function (eventName) {
    var callbacks = _callbacks[eventName];
    if (!callbacks || !callbacks.length) {
      return;
    }
    var lastResult = '';
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < callbacks.length; i++) {
      lastResult = callbacks[i].apply(this, args);
    }
    return lastResult;
  };

  // Public interface ///////////////////////////////////////////////////

  return {
    on: on,
    off: off,
    trigger: trigger,
    _callbacks,
  };
})();
