(function() {
  'use strict';
  var Intermatic, debug, freeze, push_circular, rpr, set,
    modulo = function(a, b) { return (+a % (b = +b) + b) % b; };

  //###########################################################################################################
  freeze = Object.freeze;

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

  //-----------------------------------------------------------------------------------------------------------
  push_circular = function(xs, x, max_length = 1) {
    var R;
    R = [...xs, x];
    while (R.length > max_length) {
      R.shift();
    }
    return freeze(R);
  };

  Intermatic = (function() {
    //===========================================================================================================

    //-----------------------------------------------------------------------------------------------------------
    class Intermatic {
      //---------------------------------------------------------------------------------------------------------
      constructor(fsmd) {
        // validate.fsmd fsmd
        this._tmp = {};
        this._tmp.fsmd = {...fsmd};
        this._tmp.known_names = new Set();
        this.triggers = {};
        this.lstates = null;
        this.fsm_names = [];
        this.has_subfsms = false;
        this._lstate = 'void';
        this.before = {};
        this.enter = {};
        this.stay = {};
        this.leave = {};
        this.after = {};
        this.data = {};
        this.history_length = 3;
        this._prv_lstates = [];
        this._prv_vias = [];
        this._nxt_via = null;
        this._nxt_destination = null;
        this.up = null;
        this._path = null;
        this._compile_fail();
        this._compile_cyclers();
        this._compile_triggers();
        this._compile_transitioners();
        this._compile_handlers();
        this._compile_goto();
        this._compile_can();
        this._compile_tryto();
        this._compile_subfsms();
        this._compile_data();
        this._copy_other_attributes();
        delete this._tmp;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      fail(trigger) {
        throw new Error(`^interstate/fail@556^ trigger not allowed: (${rpr(this.name)}) ${rpr(trigger)}`);
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_fail() {
        var fail;
        this._tmp.known_names.add('fail');
        if ((fail = this._tmp.fsmd.fail) == null) {
          return null;
        }
        this.fail = fail.bind(this);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_cyclers() {
        var cur_idx, cur_lstate, cyclers, i, len, lstates, nxt_idx, nxt_lstate, ref, triggers, verb;
        this._tmp.known_names.add('cyclers');
        triggers = this._tmp.fsmd.triggers = [...((ref = this._tmp.fsmd.triggers) != null ? ref : [])];
        if ((cyclers = this._tmp.fsmd.cyclers) == null) {
          return null;
        }
//.......................................................................................................
        for (verb in cyclers) {
          lstates = cyclers[verb];
          for (cur_idx = i = 0, len = lstates.length; i < len; cur_idx = ++i) {
            cur_lstate = lstates[cur_idx];
            nxt_idx = modulo(cur_idx + 1, lstates.length);
            nxt_lstate = lstates[nxt_idx];
            triggers.push([cur_lstate, verb, nxt_lstate]);
          }
        }
        //.......................................................................................................
        // freeze @_tmp.fsmd
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_triggers() {
        /* TAINT validate.list_of.list triplet */
        /* TAINT validate.verb verb */
        /* TAINT validate that free of collision */
        var base, base1, departure, destination, first_lstate, has_start, i, len, lstates, ref, ref1, starred, starred_name, t, tnames, triggers, triplet, verb;
        has_start = false;
        this.starts_with = null;
        starred = {};
        lstates = new Set(['void']);
        triggers = this._tmp.fsmd.triggers/* already a copy at this point, see @_compile_cyclers */
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
          first_lstate = (ref = (ref1 = triggers[0]) != null ? ref1[2] : void 0) != null ? ref : 'void';
          triggers.unshift(['void', 'start', first_lstate]);
        }
//.......................................................................................................
        for (i = 0, len = triggers.length; i < len; i++) {
          triplet = triggers[i];
          [departure, verb, destination] = triplet;
          //.....................................................................................................
          /* TAINT also validate that tuples [ departure, verb, ] unique */
          if (verb === 'start') {
            if (has_start) {
              throw new Error(`^interstate/fail@556^ duplica declaration of \`start\`: ${rpr(triplet)}`);
            }
            has_start = true;
            this.starts_with = destination;
          }
          //.....................................................................................................
          /* Special-case starred triggers: */
          if (departure === '*') {
            starred[verb] = destination;
            continue;
          }
          //.....................................................................................................
          lstates.add(departure);
          lstates.add(destination);
          set(((base = this.triggers)[verb] != null ? base[verb] : base[verb] = {}), departure, destination);
        }
//.......................................................................................................
        for (starred_name in starred) {
          destination = starred[starred_name];
          for (departure of lstates) {
            set(((base1 = this.triggers)[starred_name] != null ? base1[starred_name] : base1[starred_name] = {}), departure, destination);
          }
        }
        //.......................................................................................................
        this.lstates = freeze([...lstates]);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _new_tid() {
        var tid;
        tid = ++this.constructor._tid;
        return `t${tid}`;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_transitioner(verb, destinations_by_departures = null) {
        /* TAINT too much logic to be done at in run time, try to precompile more */
        var transitioner;
        return transitioner = (...P) => {
          /* TAINT use single transitioner method for all triggers? */
          var base, base1, base10, base11, base2, base3, base4, base5, base6, base7, base8, base9, changed, departure, destination, id, trigger;
          departure = this.lstate;
          id = this._new_tid();
          //-------------------------------------------------------------------------------------------------
          if (destinations_by_departures != null) {
            if ((destination = destinations_by_departures[departure]) == null) {
              trigger = freeze({
                id,
                failed: true,
                from: departure,
                via: verb
              });
              return this.fail(trigger);
            }
          } else {
            [destination, ...P] = P;
          }
          //-------------------------------------------------------------------------------------------------
          changed = destination !== departure;
          trigger = {
            id,
            from: departure,
            via: verb,
            to: destination
          };
          if (changed) {
            trigger.changed = true;
          }
          trigger = freeze(trigger);
          if (typeof (base = this.before).any === "function") {
            base.any(trigger);
          }
          if (changed) {
            if (typeof (base1 = this.before).change === "function") {
              base1.change(trigger);
            }
          }
          if (typeof (base2 = this.before)[verb] === "function") {
            base2[verb](trigger);
          }
          if (changed) {
            if (typeof (base3 = this.leave).any === "function") {
              base3.any(trigger);
            }
          }
          if (changed) {
            if (typeof (base4 = this.leave)[departure] === "function") {
              base4[departure](trigger);
            }
          }
          if (changed) {
            this.lstate = destination;
          }
          if (!changed) {
            if (typeof (base5 = this.stay).any === "function") {
              base5.any(trigger);
            }
          }
          if (!changed) {
            if (typeof (base6 = this.stay)[destination] === "function") {
              base6[destination](trigger);
            }
          }
          if (changed) {
            if (typeof (base7 = this.enter).any === "function") {
              base7.any(trigger);
            }
          }
          if (changed) {
            if (typeof (base8 = this.enter)[destination] === "function") {
              base8[destination](trigger);
            }
          }
          if (typeof (base9 = this.after)[verb] === "function") {
            base9[verb](trigger);
          }
          if (changed) {
            if (typeof (base10 = this.after).change === "function") {
              base10.change(trigger);
            }
          }
          if (typeof (base11 = this.after).any === "function") {
            base11.any(trigger);
          }
          // if @up?.after.cchange?
          //   debug '^3338398^', @up?.after.cchange, trigger
          //   @up.after.cchange trigger
          // @up?.after.cchange?       trigger if changed
          return null;
        };
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_transitioners() {
        var destinations_by_departures, ref, verb;
        this._tmp.known_names.add('triggers');
        ref = this.triggers;
        for (verb in ref) {
          destinations_by_departures = ref[verb];
          ((verb, destinations_by_departures) => {
            /* NOTE we *could* allow custom transitioners but that would only replicate behavior available
                   via `fsm.before[ verb ]()`, `fsm.after[ verb ]()`:
                   transitioner = @_tmp.fsmd[ verb ] ? @_get_transitioner verb, destinations_by_departures */
            var transitioner;
            transitioner = this._get_transitioner(verb, destinations_by_departures);
            set(this, verb, transitioner);
            return this._tmp.known_names.add(verb);
          })(verb, destinations_by_departures);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_handlers() {
        var category, error, handler, i, len, name, ref, ref1, ref2;
        try {
          ref = ['before', 'enter', 'stay', 'leave', 'after'];
          /* TAINT add handlers for trigger, change */
          /* TAINT check names against reserved */
          for (i = 0, len = ref.length; i < len; i++) {
            category = ref[i];
            this._tmp.known_names.add(category);
            ref2 = (ref1 = this._tmp.fsmd[category]) != null ? ref1 : {};
            for (name in ref2) {
              handler = ref2[name];
              this[category][name] = handler.bind(this);
            }
          }
        } catch (error1) {
          error = error1;
          error.message += ` — Error occurred during @_compile_handlers with ${rpr({category, name, handler})}`;
          throw error;
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_goto() {
        var destination, goto, i, len, ref, transitioner;
        this._tmp.known_names.add('goto');
        if ((goto = this._tmp.fsmd.goto) != null) {
          if (goto !== '*') {
            throw new Error(`^interstate/_compile_handlers@776^ expected '*' for key \`goto\`, got ${rpr(goto)}`);
          }
          transitioner = this._get_transitioner('goto', null);
          goto = (destination, ...P) => {
            return transitioner(destination, ...P);
          };
          ref = this.lstates;
          for (i = 0, len = ref.length; i < len; i++) {
            destination = ref[i];
            goto[destination] = (...P) => {
              return transitioner(destination, ...P);
            };
          }
          set(this, 'goto', goto);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_can() {
        var can, verb;
        this._tmp.known_names.add('can');
        can = (verb) => {
          var trigger;
          if ((trigger = this.triggers[verb]) == null) {
            throw new Error(`^interstate/can@822^ unknown trigger ${rpr(verb)}`);
          }
          return trigger[this.lstate] != null;
        };
        for (verb in this.triggers) {
          can[verb] = (...P) => {
            return can(verb, ...P);
          };
        }
        set(this, 'can', can);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_tryto() {
        var tryto, verb;
        this._tmp.known_names.add('tryto');
        tryto = (verb, ...P) => {
          if (!this.can(verb)) {
            return false;
          }
          /* TAINT we will possibly want to return some kind of result from trigger */
          this[verb](...P);
          return true;
        };
        for (verb in this.triggers) {
          tryto[verb] = (...P) => {
            return tryto(verb, ...P);
          };
        }
        set(this, 'tryto', tryto);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_subfsms() {
        var fsm_names, ref, ref1, sub_fname, sub_fsmd;
        this._tmp.known_names.add('fsms');
        fsm_names = [];
        ref1 = (ref = this._tmp.fsmd.fsms) != null ? ref : {};
        for (sub_fname in ref1) {
          sub_fsmd = ref1[sub_fname];
          sub_fsmd = {...sub_fsmd};
          if ((sub_fsmd.name != null) && sub_fsmd.name !== sub_fname) {
            throw new Error(`^interstate/_compile_subfsms@506^ name mismatch, got ${rpr(sub_fname)}, ${rpr(sub_fsmd.name)}`);
          }
          sub_fsmd.name = sub_fname;
          set(sub_fsmd, 'up', this);
          this._tmp.known_names.add(sub_fname);
          fsm_names.push(sub_fname);
          set(this, sub_fname, new this.constructor(sub_fsmd));
        }
        this.fsm_names = freeze(fsm_names);
        this.has_subfsms = fsm_names.length > 0;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_data() {
        var data, pname, propd, ref;
        this._tmp.known_names.add('data');
        if ((data = this._tmp.fsmd.data) == null) {
          return null;
        }
        ref = Object.getOwnPropertyDescriptors(this._tmp.fsmd.data);
        for (pname in ref) {
          propd = ref[pname];
          Object.defineProperty(this.data, pname, propd);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _copy_other_attributes() {
        var pname, propd, ref;
        ref = Object.getOwnPropertyDescriptors(this._tmp.fsmd);
        for (pname in ref) {
          propd = ref[pname];
          if (this._tmp.known_names.has(pname)) {
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
          this._prv_lstates = push_circular(this._prv_lstates, lstate, this.history_length);
          return this._lstate = lstate;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      cstate: {
        get: function() {
          var R, i, len, ref, subfsm_name;
          R = {
            _prv_lstates: this._prv_lstates/* !!!!!!!!!!!!! */,
            lstate: this.lstate,
            path: this.path,
            from: this.from,
            via: this.via,
            to: this.to,
            data: this.data
          };
          ref = this.fsm_names;
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            R[subfsm_name] = this[subfsm_name].cstate;
          }
          return freeze(R);
        }
      },
      // #-------------------------------------------------------------------------------------------------------
      // from:
      //   get: -> @_prv_lstates[ @_prv_lstates.length - 1 ] ? null
      // #-------------------------------------------------------------------------------------------------------
      // via:
      //   get: -> @_prv_vias[ @_prv_vias.length - 1 ] ? null
      //   set:  ( trigger ) -> @
      // #-------------------------------------------------------------------------------------------------------
      // to:
      //   get: -> '???'
      //-------------------------------------------------------------------------------------------------------
      from: {
        get: function() {
          var ref;
          return (ref = this._prv_lstates[this._prv_lstates.length - 1]) != null ? ref : null;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      via: {
        get: function() {
          var ref;
          return (ref = this._prv_vias[this._prv_vias.length - 1]) != null ? ref : null;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      to: {
        get: function() {
          return '???';
        }
      },
      //-------------------------------------------------------------------------------------------------------
      fsms: {
        get: function() {
          var i, len, ref, results, subfsm_name;
          ref = this.fsm_names;
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            results.push(this[subfsm_name]);
          }
          return results;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      path: {
        get: function() {
          var R;
          if ((R = this._path) != null) {
            return R;
          }
          return this._path = this.up != null ? `${this.up.path}/${this.name}` : this.name;
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