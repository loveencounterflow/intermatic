(function() {
  'use strict';
  (() => {
    var Intermatic;
    ({Intermatic} = require('./main.js'));
    if (globalThis.window != null) {
      globalThis.Intermatic = Intermatic;
    } else {
      this.Intermatic = Intermatic;
    }
    return null;
  })();

}).call(this);

//# sourceMappingURL=index.js.map