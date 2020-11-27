(function() {
  'use strict';
  var Intermatic, debug, freeze, rpr, set;

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

  Intermatic = (function() {
    //===========================================================================================================

    //-----------------------------------------------------------------------------------------------------------
    class Intermatic {
      //---------------------------------------------------------------------------------------------------------
      constructor(fsmd) {
        // validate.fsmd fsmd
        this.reserved = freeze(['void', 'start', 'stop', 'goto', 'change', 'fail']);
        this.fsmd = freeze(fsmd);
        this.triggers = {};
        this._state = 'void';
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
        /* TAINT validate.list_of.list triplet */
        /* TAINT validate.tname tname */
        /* TAINT validate that free of collision */
        var base, base1, first_sname, from_sname, has_start, i, len, ref, ref1, ref2, snames, starred, starred_name, t, tname, tnames, to_sname, triggers, triplet;
        has_start = false;
        this.starts_with = null;
        starred = {};
        snames = new Set(['void']);
        triggers = [...((ref = this.fsmd.triggers) != null ? ref : [])];
        tnames = new Set((function() {
          var i, len, results;
          results = [];
          for (i = 0, len = triggers.length; i < len; i++) {
            t = triggers[i];
            results.push(t[1]);
          }
          return results;
        })());
        //.......................................................................................................
        if (!tnames.has('start')) {
          first_sname = (ref1 = (ref2 = triggers[0]) != null ? ref2[2] : void 0) != null ? ref1 : 'void';
          triggers.unshift(['void', 'start', first_sname]);
        }
//.......................................................................................................
        for (i = 0, len = triggers.length; i < len; i++) {
          triplet = triggers[i];
          [from_sname, tname, to_sname] = triplet;
          //.....................................................................................................
          /* TAINT also validate that tuples [ from_sname, tname, ] unique */
          if (tname === 'start') {
            if (has_start) {
              throw new Error(`^interstate/fail@556^ duplica declaration of \`start\`: ${rpr(triplet)}`);
            }
            has_start = true;
            this.starts_with = to_sname;
          }
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
            /* NOTE we *could* allow custom transitioners but that would only replicate behavior available
                   via `fsm.before[ tname ]()`, `fsm.after[ tname ]()`:
                   transitioner = @fsmd[ tname ] ? @_get_transitioner tname, from_and_to_states */
            var transitioner;
            transitioner = this._get_transitioner(tname, from_and_to_states);
            return set(this, tname, transitioner);
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

    //---------------------------------------------------------------------------------------------------------
    Object.defineProperties(Intermatic.prototype, {
      state: {
        get: function() {
          return this._state;
        },
        set: function(sname) {
          if (typeof sname !== 'string') {
            throw new Error(`^interstate/set/state@501^ state name must be text, got ${rpr(sname)}`);
          }
          return this._state = sname;
        }
      }
    });

    return Intermatic;

  }).call(this);

  //###########################################################################################################
  module.exports = Intermatic;

  // if globalThis.require? then module.exports        = { Intermatic, }
// else                        globalThis.Intermatic = Intermatic

}).call(this);

//# sourceMappingURL=main.js.map