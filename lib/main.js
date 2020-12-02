(function() {
  'use strict';
  var Intermatic, debug, freeze, rpr, set,
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

  Intermatic = (function() {
    //===========================================================================================================

    //-----------------------------------------------------------------------------------------------------------
    class Intermatic {
      //---------------------------------------------------------------------------------------------------------
      // constructor: ( fname, fsmd ) ->
      constructor(fsmd) {
        // validate.fsmd fsmd
        this._covered_names = new Set();
        this.fsmd = {...fsmd};
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
        this.up = null;
        this._path = null;
        this._compile_cyclers();
        this._compile_triggers();
        this._compile_transitioners();
        this._compile_handlers();
        this._compile_goto();
        this._compile_can();
        this._compile_tryto();
        this._compile_subfsms();
        this._copy_other_attributes();
        delete this._covered_names;
        // delete @fsmd
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      fail(trigger) {
        throw new Error(`^interstate/fail@556^ trigger not allowed: (${rpr(this.name)}) ${rpr(trigger)}`);
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_cyclers() {
        var cur_idx, cur_lstate, cyclers, i, len, lstates, nxt_idx, nxt_lstate, ref, tname, triggers;
        this._covered_names.add('cyclers');
        triggers = this.fsmd.triggers = [...((ref = this.fsmd.triggers) != null ? ref : [])];
        if ((cyclers = this.fsmd.cyclers) == null) {
          return null;
        }
//.......................................................................................................
        for (tname in cyclers) {
          lstates = cyclers[tname];
          for (cur_idx = i = 0, len = lstates.length; i < len; cur_idx = ++i) {
            cur_lstate = lstates[cur_idx];
            nxt_idx = modulo(cur_idx + 1, lstates.length);
            nxt_lstate = lstates[nxt_idx];
            triggers.push([cur_lstate, tname, nxt_lstate]);
          }
        }
        //.......................................................................................................
        // freeze @fsmd
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_triggers() {
        /* TAINT validate.list_of.list triplet */
        /* TAINT validate.tname tname */
        /* TAINT validate that free of collision */
        var base, base1, first_lstate, from_lstate, has_start, i, len, lstates, ref, ref1, starred, starred_name, t, tname, tnames, to_lstate, triggers, triplet;
        has_start = false;
        this.starts_with = null;
        starred = {};
        lstates = new Set(['void']);
        triggers = this.fsmd.triggers/* already a copy at this point, see @_compile_cyclers */
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
      _get_transitioner(tname, from_and_to_lstates = null) {
        /* TAINT too much logic to be done at in run time, try to precompile more */
        var $key, transitioner;
        $key = '^trigger';
        return transitioner = (...P) => {
          /* TAINT use single transitioner method for all triggers? */
          var base, base1, base10, base11, base2, base3, base4, base5, base6, base7, base8, base9, changed, from_lstate, id, to_lstate, trigger;
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
          if (typeof (base = this.before).any === "function") {
            base.any(trigger);
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
            if (typeof (base3 = this.leave).any === "function") {
              base3.any(trigger);
            }
          }
          if (changed) {
            if (typeof (base4 = this.leave)[from_lstate] === "function") {
              base4[from_lstate](trigger);
            }
          }
          if (changed) {
            this.lstate = to_lstate;
          }
          if (!changed) {
            if (typeof (base5 = this.stay).any === "function") {
              base5.any(trigger);
            }
          }
          if (!changed) {
            if (typeof (base6 = this.stay)[to_lstate] === "function") {
              base6[to_lstate](trigger);
            }
          }
          if (changed) {
            if (typeof (base7 = this.enter).any === "function") {
              base7.any(trigger);
            }
          }
          if (changed) {
            if (typeof (base8 = this.enter)[to_lstate] === "function") {
              base8[to_lstate](trigger);
            }
          }
          if (typeof (base9 = this.after)[tname] === "function") {
            base9[tname](trigger);
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
        var goto, i, len, ref, to_lstate, transitioner;
        this._covered_names.add('goto');
        if ((goto = this.fsmd.goto) != null) {
          if (goto !== '*') {
            throw new Error(`^interstate/_compile_handlers@776^ expected '*' for key \`goto\`, got ${rpr(goto)}`);
          }
          transitioner = this._get_transitioner('goto', null);
          goto = (to_lstate, ...P) => {
            return transitioner(to_lstate, ...P);
          };
          ref = this.lstates;
          for (i = 0, len = ref.length; i < len; i++) {
            to_lstate = ref[i];
            goto[to_lstate] = (...P) => {
              return transitioner(to_lstate, ...P);
            };
          }
          set(this, 'goto', goto);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_can() {
        var can, tname;
        this._covered_names.add('can');
        can = (tname) => {
          var trigger;
          if ((trigger = this.triggers[tname]) == null) {
            throw new Error(`^interstate/can@822^ unknown trigger ${rpr(tname)}`);
          }
          return trigger[this.lstate] != null;
        };
        for (tname in this.triggers) {
          can[tname] = (...P) => {
            return can(tname, ...P);
          };
        }
        set(this, 'can', can);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_tryto() {
        var tname, tryto;
        this._covered_names.add('tryto');
        tryto = (tname, ...P) => {
          if (!this.can(tname)) {
            return false;
          }
          /* TAINT we will possibly want to return some kind of result from trigger */
          this[tname](...P);
          return true;
        };
        for (tname in this.triggers) {
          tryto[tname] = (...P) => {
            return tryto(tname, ...P);
          };
        }
        set(this, 'tryto', tryto);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_subfsms() {
        var fsm_names, ref, ref1, sub_fname, sub_fsmd;
        this._covered_names.add('fsms');
        fsm_names = [];
        ref1 = (ref = this.fsmd.fsms) != null ? ref : {};
        for (sub_fname in ref1) {
          sub_fsmd = ref1[sub_fname];
          sub_fsmd = {...sub_fsmd};
          if ((sub_fsmd.name != null) && sub_fsmd.name !== sub_fname) {
            throw new Error(`^interstate/_compile_subfsms@506^ name mismatch, got ${rpr(sub_fname)}, ${rpr(sub_fsmd.name)}`);
          }
          sub_fsmd.name = sub_fname;
          set(sub_fsmd, 'up', this);
          this._covered_names.add(sub_fname);
          fsm_names.push(sub_fname);
          set(this, sub_fname, new this.constructor(sub_fsmd));
        }
        this.fsm_names = freeze(fsm_names);
        this.has_subfsms = fsm_names.length > 0;
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
          ref = this.fsm_names;
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            R[subfsm_name] = this[subfsm_name].cstate;
          }
          return freeze(R);
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