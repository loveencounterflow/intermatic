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
      // constructor: ( fname, fsmd ) ->
      constructor(fsmd) {
        // validate.fsmd fsmd
        this._covered_names = new Set();
        this.reserved = freeze(['void', 'start', 'stop', 'goto', 'change', 'fail']);
        this.fsmd = freeze(fsmd);
        this.triggers = {};
        this.subfsm_names = [];
        this.has_subfsms = false;
        this._lstate = 'void';
        // @states         = {}
        this.before = {};
        this.enter = {};
        this.stay = {};
        this.leave = {};
        this.after = {};
        this.up = null;
        this._compile_triggers();
        this._compile_transitioners();
        this._compile_handlers();
        this._compile_goto();
        this._compile_subfsms();
        this._copy_other_attributes();
        delete this._covered_names;
        return null;
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
        var base, base1, first_lstate, from_lstate, has_start, i, len, lstates, ref, ref1, ref2, starred, starred_name, t, tname, tnames, to_lstate, triggers, triplet;
        has_start = false;
        this.starts_with = null;
        starred = {};
        lstates = new Set(['void']);
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
          first_lstate = (ref1 = (ref2 = triggers[0]) != null ? ref2[2] : void 0) != null ? ref1 : 'void';
          triggers.unshift(['void', 'start', first_lstate]);
        }
//.......................................................................................................
        for (i = 0, len = triggers.length; i < len; i++) {
          triplet = triggers[i];
          [from_lstate, tname, to_lstate] = triplet;
          //.....................................................................................................
          /* TAINT also validate that tuples [ from_lstate, tname, ] unique */
          if (tname === 'start') {
            if (has_start) {
              throw new Error(`^interstate/fail@556^ duplica declaration of \`start\`: ${rpr(triplet)}`);
            }
            has_start = true;
            this.starts_with = to_lstate;
          }
          //.....................................................................................................
          /* Special-case starred triggers: */
          if (from_lstate === '*') {
            starred[tname] = to_lstate;
            continue;
          }
          //.....................................................................................................
          lstates.add(from_lstate);
          lstates.add(to_lstate);
          set(((base = this.triggers)[tname] != null ? base[tname] : base[tname] = {}), from_lstate, to_lstate);
        }
//.......................................................................................................
        for (starred_name in starred) {
          to_lstate = starred[starred_name];
          for (from_lstate of lstates) {
            set(((base1 = this.triggers)[starred_name] != null ? base1[starred_name] : base1[starred_name] = {}), from_lstate, to_lstate);
          }
        }
        //.......................................................................................................
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _new_tid() {
        var tid;
        tid = ++this.constructor._tid;
        return `t${tid}`;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_transitioner(tname, from_and_to_lstates = null) {
        /* TAINT too much logic to be done at in run time, try to precompile more */
        var $key, transitioner;
        $key = '^trigger';
        return transitioner = (...P) => {
          /* TAINT use single transitioner method for all triggers? */
          var base, base1, base2, base3, base4, base5, base6, base7, base8, changed, from_lstate, id, to_lstate, trigger;
          from_lstate = this.lstate;
          id = this._new_tid();
          //-------------------------------------------------------------------------------------------------
          if (from_and_to_lstates != null) {
            if ((to_lstate = from_and_to_lstates[this.lstate]) == null) {
              trigger = freeze({
                $key,
                id,
                failed: true,
                from: from_lstate,
                via: tname
              });
              if (this.fsmd.fail != null) {
                return this.fsmd.fail(trigger);
              }
              return this.fail(trigger);
            }
          } else {
            [to_lstate, ...P] = P;
          }
          //-------------------------------------------------------------------------------------------------
          changed = to_lstate !== from_lstate;
          trigger = freeze({
            $key,
            id,
            from: from_lstate,
            via: tname,
            to: to_lstate,
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
            if (typeof (base3 = this.leave)[from_lstate] === "function") {
              base3[from_lstate](trigger);
            }
          }
          if (changed) {
            this.lstate = to_lstate;
          }
          if (!changed) {
            if (typeof (base4 = this.stay)[to_lstate] === "function") {
              base4[to_lstate](trigger);
            }
          }
          if (changed) {
            if (typeof (base5 = this.enter)[to_lstate] === "function") {
              base5[to_lstate](trigger);
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
        var from_and_to_lstates, ref, tname;
        this._covered_names.add('triggers');
        ref = this.triggers;
        for (tname in ref) {
          from_and_to_lstates = ref[tname];
          ((tname, from_and_to_lstates) => {
            /* NOTE we *could* allow custom transitioners but that would only replicate behavior available
                   via `fsm.before[ tname ]()`, `fsm.after[ tname ]()`:
                   transitioner = @fsmd[ tname ] ? @_get_transitioner tname, from_and_to_lstates */
            var transitioner;
            transitioner = this._get_transitioner(tname, from_and_to_lstates);
            set(this, tname, transitioner);
            return this._covered_names.add(tname);
          })(tname, from_and_to_lstates);
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
          this._covered_names.add(category);
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
        this._covered_names.add('goto');
        if ((goto = this.fsmd.goto) != null) {
          if (goto !== '*') {
            throw new Error(`^interstate/_compile_handlers@776^ expected '*' for key \`goto\`, got ${rpr(goto)}`);
          }
          transitioner = this._get_transitioner('goto', null);
          set(this, 'goto', (to_lstate) => {
            return transitioner(to_lstate);
          });
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_subfsms() {
        var ref, ref1, sub_fname, sub_fsmd, subfsm_names;
        this._covered_names.add('subs');
        subfsm_names = [];
        ref1 = (ref = this.fsmd.subs) != null ? ref : {};
        for (sub_fname in ref1) {
          sub_fsmd = ref1[sub_fname];
          sub_fsmd = {...sub_fsmd};
          if ((sub_fsmd.name != null) && sub_fsmd.name !== sub_fname) {
            throw new Error(`^interstate/_compile_subfsms@506^ name mismatch, got ${rpr(sub_fname)}, ${rpr(sub_fsmd.name)}`);
          }
          sub_fsmd.name = sub_fname;
          set(sub_fsmd, 'up', this);
          this._covered_names.add(sub_fname);
          subfsm_names.push(sub_fname);
          set(this, sub_fname, new this.constructor(sub_fsmd));
        }
        this.subfsm_names = freeze(subfsm_names);
        this.has_subfsms = subfsm_names.length > 0;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _copy_other_attributes() {
        var pname, propd, ref;
        ref = Object.getOwnPropertyDescriptors(this.fsmd);
        for (pname in ref) {
          propd = ref[pname];
          if (this._covered_names.has(pname)) {
            continue;
          }
          Object.defineProperty(this, pname, propd);
        }
        return null;
      }

    };

    //---------------------------------------------------------------------------------------------------------
    Intermatic._tid = 0;

    //---------------------------------------------------------------------------------------------------------
    Object.defineProperties(Intermatic.prototype, {
      //-------------------------------------------------------------------------------------------------------
      lstate: {
        get: function() {
          return this._lstate;
        },
        set: function(lstate) {
          if (typeof lstate !== 'string') {
            throw new Error(`^interstate/set/lstate@501^ lstate name must be text, got ${rpr(lstate)}`);
          }
          return this._lstate = lstate;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      cstate: {
        get: function() {
          var R, i, len, ref, subfsm_name;
          if (!this.has_subfsms) {
            return this.lstate;
          }
          R = {
            _: this.lstate
          };
          ref = this.subfsm_names;
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            R[subfsm_name] = this[subfsm_name].cstate;
          }
          return freeze(R);
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


},{}]},{},[1]);
