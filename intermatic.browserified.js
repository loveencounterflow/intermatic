(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function() {
  'use strict';
  (() => {
    var Intermatic;
    Intermatic = require('./main.js');
    if (globalThis.window != null) {
      globalThis.Intermatic = Intermatic;
    } else {
      module.exports = Intermatic;
    }
    return null;
  })();

}).call(this);


},{"./main.js":2}],2:[function(require,module,exports){
(function() {
  'use strict';
  var Fsm, Intermatic, debug, freeze, rpr, set;

  // ############################################################################################################
  // CND                       = require 'cnd'
  // rpr                       = CND.rpr
  // badge                     = 'MKTS-GUI-TOOLBOX-FSM'
  // debug                     = CND.get_logger 'debug',     badge
  // warn                      = CND.get_logger 'warn',      badge
  // info                      = CND.get_logger 'info',      badge
  // urge                      = CND.get_logger 'urge',      badge
  // help                      = CND.get_logger 'help',      badge
  // whisper                   = CND.get_logger 'whisper',   badge
  // echo                      = CND.echo.bind CND
  // #...........................................................................................................
  // types                     = new ( require 'intertype' ).Intertype()
  // { isa
  //   validate
  //   declare
  //   type_of }               = types.export()
  // { freeze
  //   lets }                  = require 'letsfreezethat'
  freeze = Object.freeze;

  // if globalThis.require?
  //   StateMachine              = require 'javascript-state-machine'
  // Mutimix                   = require 'multimix'

  // #-----------------------------------------------------------------------------------------------------------
  // warn = ( message ) ->
  //   if µ?.DOM?.warn?        then µ.DOM.warn message
  //   else if console?.warn?  then console.warn message
  //   else throw new Error message
  //   return null

  // #===========================================================================================================
  // class Fsm extends Multimix
  //   constructor: ( fsmd ) ->
  //     # validate.fsmd fsmd

  // #===========================================================================================================
  // class Compund_fsm extends Multimix
  //   constructor: ( fsmds ) ->
  //     # validate.fsmds fsmds
  if (globalThis.debug == null) {
    debug = console.debug;
  }

  if (globalThis.rpr == null) {
    rpr = JSON.stringify;
  }

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  set = function(target, key, value) {
    if (target[key] != null) {
      throw new Error(`^interstate/set@776^ name collision: ${rpr(key)}`);
    }
    target[key] = value;
    return value;
  };

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  Fsm = class Fsm {
    //---------------------------------------------------------------------------------------------------------
    constructor(fsmd) {
      // validate.fsmd fsmd
      this.reserved = freeze(['void', 'start', 'stop', 'goto', 'change', 'fail']);
      this.fsmd = freeze(fsmd);
      this.state = freeze({});
      this.triggers = {};
      this.state = 'void';
      // @states       = {}
      this.before = {};
      this.enter = {};
      this.stay = {};
      this.leave = {};
      this.after = {};
      this.my = {};
      this.our = null;
      this._compile_triggers();
      this._compile_transitioners();
      this._compile_handlers();
      this._compile_goto();
    }

    //---------------------------------------------------------------------------------------------------------
    fail(trigger) {
      throw new Error(`^interstate/fail@556^ trigger not allowed: ${rpr(trigger)}`);
    }

    //---------------------------------------------------------------------------------------------------------
    _compile_triggers() {
      /* TAINT validate.list triplet */
      /* TAINT validate.tname tname */
      /* TAINT validate that free of collision */
      var base, base1, from_sname, i, len, ref, ref1, snames, starred, starred_name, tname, to_sname, triplet;
      starred = {};
      snames = new Set(['void']);
      ref1 = (ref = this.fsmd.triggers) != null ? ref : [];
      //.......................................................................................................
      for (i = 0, len = ref1.length; i < len; i++) {
        triplet = ref1[i];
        [from_sname, tname, to_sname] = triplet;
        //.....................................................................................................
        /* Special-case starred triggers: */
        if (from_sname === '*') {
          starred[tname] = to_sname;
          continue;
        }
        //.....................................................................................................
        snames.add(from_sname);
        snames.add(to_sname);
        set(((base = this.triggers)[tname] != null ? base[tname] : base[tname] = {}), from_sname, to_sname);
      }
//.......................................................................................................
      for (starred_name in starred) {
        to_sname = starred[starred_name];
        for (from_sname of snames) {
          set(((base1 = this.triggers)[starred_name] != null ? base1[starred_name] : base1[starred_name] = {}), from_sname, to_sname);
        }
      }
      //.......................................................................................................
      return null;
    }

    //---------------------------------------------------------------------------------------------------------
    _get_transitioner(tname, from_and_to_states = null) {
      /* TAINT too much logic to be done at in run time, try to precompile more */
      var $key, transitioner;
      $key = '^trigger';
      return transitioner = (...P) => {
        /* TAINT use single transitioner method for all triggers? */
        var base, base1, base2, base3, base4, base5, base6, base7, base8, changed, from_sname, to_sname, trigger;
        from_sname = this.state;
        //-------------------------------------------------------------------------------------------------
        if (from_and_to_states != null) {
          if ((to_sname = from_and_to_states[this.state]) == null) {
            trigger = freeze({
              $key,
              failed: true,
              from: from_sname,
              via: tname
            });
            if (this.fsmd.fail != null) {
              return this.fsmd.fail(trigger);
            }
            return this.fail(trigger);
          }
        } else {
          [to_sname, ...P] = P;
        }
        //-------------------------------------------------------------------------------------------------
        changed = to_sname !== from_sname;
        trigger = freeze({
          $key,
          from: from_sname,
          via: tname,
          to: to_sname,
          changed
        });
        if (typeof (base = this.before).trigger === "function") {
          base.trigger(trigger);
        }
        if (changed) {
          if (typeof (base1 = this.before).change === "function") {
            base1.change(trigger);
          }
        }
        if (typeof (base2 = this.before)[tname] === "function") {
          base2[tname](trigger);
        }
        if (changed) {
          if (typeof (base3 = this.leave)[from_sname] === "function") {
            base3[from_sname](trigger);
          }
        }
        if (changed) {
          this.state = to_sname;
        }
        if (!changed) {
          if (typeof (base4 = this.stay)[to_sname] === "function") {
            base4[to_sname](trigger);
          }
        }
        if (changed) {
          if (typeof (base5 = this.enter)[to_sname] === "function") {
            base5[to_sname](trigger);
          }
        }
        if (typeof (base6 = this.after)[tname] === "function") {
          base6[tname](trigger);
        }
        if (changed) {
          if (typeof (base7 = this.after).change === "function") {
            base7.change(trigger);
          }
        }
        if (typeof (base8 = this.after).trigger === "function") {
          base8.trigger(trigger);
        }
        return null;
      };
    }

    //---------------------------------------------------------------------------------------------------------
    _compile_transitioners() {
      var from_and_to_states, ref, tname;
      ref = this.triggers;
      for (tname in ref) {
        from_and_to_states = ref[tname];
        ((tname, from_and_to_states) => {
          if (this[tname] != null) {
            throw new Error(`^interstate/_compile_triggers@516^ transitioner ${rpr(tname)} already defined`);
          }
          return this[tname] = this._get_transitioner(tname, from_and_to_states);
        })(tname, from_and_to_states);
      }
      return null;
    }

    //---------------------------------------------------------------------------------------------------------
    _compile_handlers() {
      var category, handler, i, len, name, ref, ref1, ref2;
      ref = ['before', 'enter', 'stay', 'leave', 'after'];
      /* TAINT add handlers for trigger, change */
      /* TAINT check names against reserved */
      for (i = 0, len = ref.length; i < len; i++) {
        category = ref[i];
        ref2 = (ref1 = this.fsmd[category]) != null ? ref1 : {};
        for (name in ref2) {
          handler = ref2[name];
          this[category][name] = handler.bind(this);
        }
      }
      return null;
    }

    //---------------------------------------------------------------------------------------------------------
    _compile_goto() {
      var goto, transitioner;
      if ((goto = this.fsmd.goto) != null) {
        if (goto !== '*') {
          throw new Error(`^interstate/_compile_handlers@776^ expected '*' for key \`goto\`, got ${rpr(goto)}`);
        }
        transitioner = this._get_transitioner('goto', null);
        set(this, 'goto', (to_sname) => {
          return transitioner(to_sname);
        });
      }
      return null;
    }

  };

  Intermatic = (function() {
    //===========================================================================================================
    class Intermatic {
      //---------------------------------------------------------------------------------------------------------
      constructor(cfsmd) {
        var fname, fsm, fsmd;
        for (fname in cfsmd) {
          fsmd = cfsmd[fname];
          set(this, fname, fsm = {
            name: fname,
            ...fsmd
          });
        }
      }

    };

    Intermatic.Fsm = Fsm;

    return Intermatic;

  }).call(this);

  //###########################################################################################################
  module.exports = Intermatic;

  // if globalThis.require? then module.exports        = { Intermatic, }
// else                        globalThis.Intermatic = Intermatic

}).call(this);


},{}]},{},[1]);
