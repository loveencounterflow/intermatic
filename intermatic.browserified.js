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
  var Intermatic, debug, declare, freeze, isa, misfit, push_circular, rpr, set, types, validate;

  //###########################################################################################################
  types = new (require('intertype')).Intertype();

  ({validate, isa, declare} = types.export());

  freeze = Object.freeze;

  misfit = Symbol('misfit');

  if (globalThis.debug == null) {
    debug = console.debug;
  }

  if (globalThis.rpr == null) {
    rpr = JSON.stringify;
  }

  //===========================================================================================================
  // TYPES
  //-----------------------------------------------------------------------------------------------------------
  declare('trajectory', {
    tests: {
      "x isa list of texts": function(x) {
        return this.isa.list_of('text', x);
      },
      "length is 0 or > 1": function(x) {
        return (x.length === 0) || (x.length > 1);
      }
    }
  });

  //-----------------------------------------------------------------------------------------------------------
  declare('start_trajectory', {
    tests: {
      "x is either a trajectory or a lstate": function(x) {
        return (this.isa.trajectory(x)) || (this.isa.lstate(x));
      }
    }
  });

  //-----------------------------------------------------------------------------------------------------------
  declare('verb', {
    tests: {
      "x isa nonempty_text": function(x) {
        return this.isa.nonempty_text(x);
      }
    }
  });

  // "x is not a reserved word": ( x ) ->
  // "x is not an lstate": ( x ) ->
  // or test against catalog of known verbs

  //-----------------------------------------------------------------------------------------------------------
  declare('lstate', {
    tests: {
      "x isa nonempty_text": function(x) {
        return this.isa.nonempty_text(x);
      }
    }
  });

  // "x is not a reserved word": ( x ) ->
  // "x is not an verb": ( x ) ->
  // or test against catalog of known verbs

  //-----------------------------------------------------------------------------------------------------------
  declare('goto_target', {
    tests: {
      "x is 'any'": function(x) {
        return x === 'any';
      }
    }
  });

  //-----------------------------------------------------------------------------------------------------------
  declare('actions', {
    tests: {
      /* TAINT allow async functions */
      "x isa list of functions": function(x) {
        return this.isa.list_of('function', x);
      }
    }
  });

  //-----------------------------------------------------------------------------------------------------------
  declare('fsmd_multitrajectory', function(x) {
    if (!this.isa.list(x)) {
      return false;
    }
    if (!this.isa.list(x[0])) {
      return false;
    }
    return this.isa.list_of('trajectory', x);
  });

  //-----------------------------------------------------------------------------------------------------------
  declare('fsmd_moves', {
    tests: {
      "x is an object": function(x) {
        return this.isa.object(x);
      },
      "keys of x are verbs": function(x) {
        return (Object.keys(x)).every((k) => {
          return this.isa.verb(k);
        });
      },
      "values of x are trajectories (or start_trajectories) or a list of those": function(x) {
        var k, v;
        for (k in x) {
          v = x[k];
          if (k === 'start') {
            if (!this.isa.start_trajectory(v)) {
              return false;
            }
            continue;
          }
          if (!((this.isa.trajectory(v)) || (this.isa.fsmd_multitrajectory(v)))) {
            /* NOTE this allows lists of trajectories for verbs other than 'start' only */
            return false;
          }
        }
        return true;
      }
    }
  });

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  set = function(target, key, value) {
    if (target[key] !== void 0) {
      throw new Error(`^intermatic/set@776^ name collision: ${rpr(key)}`);
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
        // @_types             = types
        this._tmp = {};
        this._tmp.fsmd = {...fsmd};
        this._tmp.known_names = new Set();
        // @_mnames            = new Set()
        this.moves = null;
        this.cascades = null;
        this.lstates = null;
        this.fsm_names = [];
        this.has_subfsms = false;
        this._stage = null;
        this._lstate = 'void';
        this._root_fsm = misfit;
        this._reserved_keys = new Set();
        this._trigger_stages = freeze(['before', 'after']);
        this._state_stages = freeze(['entering', 'leaving', 'keeping']);
        (() => {
          var i, len, ref, results, stage, stages;
          ref = [this._trigger_stages, this._state_stages];
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            stages = ref[i];
            results.push((function() {
              var j, len1, results1;
              results1 = [];
              for (j = 0, len1 = stages.length; j < len1; j++) {
                stage = stages[j];
                results1.push(set(this, stage, {}));
              }
              return results1;
            }).call(this));
          }
          return results;
        })();
        this.data = null;
        this.history_length = 1;
        this._cancelled = null;
        this._prv_lstates = [this._lstate];
        this._prv_verbs = [];
        this._nxt_dpar = null;
        this._nxt_dest = null;
        this._nxt_verb = null;
        /* TAINT use read-only property */
        this.up = null;
        this._path = null;
        (() => {          //.......................................................................................................
          var k, results;
          results = [];
          for (k in this) {
            results.push(this._reserved_keys.add(k));
          }
          return results;
        })();
        //.......................................................................................................
        this._compile_fail();
        // @_compile_cyclers()
        this._compile_moves();
        this._compile_triggers();
        this._compile_actions();
        // @_compile_handlers()
        this._compile_goto();
        this._compile_can();
        this._compile_tryto();
        this._compile_subfsms();
        // @_compile_data()
        this._compile_cascades();
        // @_compile_root_fsms()
        this._copy_other_attributes();
        delete this._tmp;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      fail() {
        throw new Error(`^intermatic/fail@557^ trigger not allowed: ${rpr({
          name: this.name,
          verb: this.verb,
          dpar: this.dpar
        })}`);
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
      _compile_moves() {
        var fsmd_moves, i, len, lstates, monotrajectory, ref, trajectory, verb, verbs;
        this._tmp.known_names.add('moves');
        // starred       = {}
        lstates = new Set(['void']);
        fsmd_moves = (ref = this._tmp.fsmd.moves) != null ? ref : {};
        validate.fsmd_moves(fsmd_moves);
        fsmd_moves = this._tmp.fsmd.moves = {...fsmd_moves};
        this.moves = {};
        verbs = (function() {
          var results;
          results = [];
          for (verb in fsmd_moves) {
            results.push(verb);
          }
          return results;
        })();
//.......................................................................................................
        for (verb in fsmd_moves) {
          trajectory = fsmd_moves[verb];
          /* If the verb is `start`, then value may be just the name of the start verb instead of a list */
          validate.verb(verb);
          if ((verb === 'start') && (!isa.list(trajectory))) {
            trajectory = ['void', trajectory];
          }
          if (!(trajectory.length > 0)) {
            continue;
          }
          //.....................................................................................................
          if (isa.fsmd_multitrajectory(trajectory)) {
            for (i = 0, len = trajectory.length; i < len; i++) {
              monotrajectory = trajectory[i];
              this._compile_monotrajectory(lstates, verb, monotrajectory);
            }
          } else {
            this._compile_monotrajectory(lstates, verb, trajectory);
          }
        }
        //.......................................................................................................
        this.lstates = freeze([...lstates]);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_monotrajectory(lstates, verb, trajectory) {
        /* TAINT validate that free of collision */
        var base, dest, dpar, i, ref, tidx;
        for (tidx = i = 0, ref = trajectory.length - 1; (0 <= ref ? i < ref : i > ref); tidx = 0 <= ref ? ++i : --i) {
          dpar = trajectory[tidx];
          dest = trajectory[tidx + 1];
          //...................................................................................................
          lstates.add(dpar);
          lstates.add(dest);
          set(((base = this.moves)[verb] != null ? base[verb] : base[verb] = {}), dpar, dest);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_triggers() {
        var dests_by_deps, ref, verb;
        ref = this.moves;
        for (verb in ref) {
          dests_by_deps = ref[verb];
          ((verb, dests_by_deps) => {
            var trigger;
            trigger = this._get_trigger(verb, dests_by_deps);
            set(this, verb, trigger);
            return this._tmp.known_names.add(verb);
          })(verb, dests_by_deps);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_actions() {
        var actions, i, j, len, len1, lstate, ref, ref1, source, stage, target, verb;
        ref = this._trigger_stages;
        //.......................................................................................................
        for (i = 0, len = ref.length; i < len; i++) {
          stage = ref[i];
          this._tmp.known_names.add(stage);
          if ((source = this._tmp.fsmd[stage]) == null) {
            continue;
          }
          target = this[stage];
          for (verb in source) {
            actions = source[verb];
            /* TAINT validate.verb verb; esp validate not an lstate */
            validate.verb(verb);
            if (!isa.list(actions)) {
              actions = [actions];
            }
            validate.actions(actions);
            set(target, verb, actions);
          }
        }
        ref1 = this._state_stages;
        //.......................................................................................................
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          stage = ref1[j];
          this._tmp.known_names.add(stage);
          if ((source = this._tmp.fsmd[stage]) == null) {
            continue;
          }
          target = this[stage];
          for (lstate in source) {
            actions = source[lstate];
            /* TAINT validate.lstate lstate; esp validate not a verb */
            validate.lstate(lstate);
            if (!isa.list(actions)) {
              actions = [actions];
            }
            validate.actions(actions);
            set(target, lstate, actions);
          }
        }
        //.......................................................................................................
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _call_actions(stage, verb_or_lstate, P) {
        var i, len, ref, transitioner, transitioners;
        this._stage = stage;
        if ((transitioners = (ref = this[stage]) != null ? ref[verb_or_lstate] : void 0) == null) {
          return null;
        }
        for (i = 0, len = transitioners.length; i < len; i++) {
          transitioner = transitioners[i];
          transitioner.apply(this, P);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_trigger(verb, dests_by_deps = null) {
        /* TAINT too much logic to be done at in run time, try to precompile more */
        var transitioner;
        return transitioner = (...P) => {
          var changed, dest, dpar, i, len, ref, ref1, ref2, subfsm_name;
          /* TAINT use single transitioner method for all triggers? */
          this._nxt_verb = verb;
          /* TAINT consider to do this inside a property setter, as for `@lstate`: */
          this._prv_verbs = push_circular(this._prv_verbs, verb, this.history_length);
          this._nxt_dpar = dpar = this.lstate;
          //-------------------------------------------------------------------------------------------------
          if (dests_by_deps != null) {
            dest = (ref = (ref1 = dests_by_deps[dpar]) != null ? ref1 : dests_by_deps.any) != null ? ref : null;
          } else {
            [dest, ...P] = P;
          }
          if (dest == null) {
            return this.fail(...P);
          }
          //.....................................................................................................
          this._nxt_dest = dest;
          changed = dest !== dpar;
          this._cancelled = false;
          //.....................................................................................................
          if (this.cascades && this.cascades.has(verb)) {
            ref2 = this.fsm_names;
            for (i = 0, len = ref2.length; i < len; i++) {
              subfsm_name = ref2[i];
              this[subfsm_name].tryto(verb, ...P);
            }
          }
          while (true) {
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            //.....................................................................................................
            this._call_actions('before', 'any', P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions('before', 'change', P);
            }
            if (this._cancelled) {
              break;
            }
            this._call_actions('before', verb, P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
              this._call_actions('leaving', 'any', P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions('leaving', dpar, P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              //...................................................................................................
              this.lstate = dest;
            }
            if (!changed) {
              //...................................................................................................
              this._call_actions('keeping', 'any', P);
            }
            if (this._cancelled) {
              break;
            }
            if (!changed) {
              this._call_actions('keeping', dpar, P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
              this._call_actions('entering', 'any', P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions('entering', dest, P);
            }
            if (this._cancelled) {
              break;
            }
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            this._call_actions('after', 'any', P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions('after', 'change', P);
            }
            if (this._cancelled) {
              break;
            }
            this._call_actions('after', verb, P);
            if (this._cancelled) {
              break;
            }
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            break;
          }
          //.....................................................................................................
          if (this._cancelled) {
            debug('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> CANCELLED <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
          }
          /* TAINT not yet implemented */
          /* TAINT should be done in a method */
          /* TAINT alternatively consider to change values in temp object, only push to history when succesfull */
          // @_prv_lstates.pop()
          // @_prv_verbs.pop()
          // @_lstate = @_nxt_dpar
          // debug @cstate
          //.....................................................................................................
          /* NOTE At this point, the transition has finished, so we reset the `@_nxt_*` attributes: */
          this._cancelled = null;
          this._stage = null;
          this._nxt_verb = null;
          this._nxt_dest = null;
          this._nxt_dpar = null;
          //.....................................................................................................
          return null;
        };
      }

      //---------------------------------------------------------------------------------------------------------
      cancel() {
        if (this._stage == null) {
          throw new Error("^intermatic/cancel@886^ can only cancel during move");
        }
        this._cancelled = true;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_goto() {
        var dest, goto, i, len, ref, transitioner;
        this._tmp.known_names.add('goto');
        if ((goto = this._tmp.fsmd.goto) != null) {
          validate.goto_target(goto);
          transitioner = this._get_trigger('goto', null);
          goto = (dest, ...P) => {
            return transitioner(dest, ...P);
          };
          ref = this.lstates;
          for (i = 0, len = ref.length; i < len; i++) {
            dest = ref[i];
            ((dest) => {
              return goto[dest] = (...P) => {
                return transitioner(dest, ...P);
              };
            })(dest);
          }
          set(this, 'goto', goto);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_can() {
        var can, can_proxy;
        this._tmp.known_names.add('can');
        //.......................................................................................................
        can = (verb) => {
          var transitions;
          if ((transitions = this.moves[verb]) == null) {
            throw new Error(`^intermatic/can@822^ unknown verb ${rpr(verb)}`);
          }
          return transitions[this.lstate] != null;
        };
        //.......................................................................................................
        can_proxy = new Proxy(can, {
          get: function(target, key) {
            return function() {
              return target(key);
            };
          }
        });
        //.......................................................................................................
        set(this, 'can', can_proxy);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_tryto() {
        var tryto, tryto_proxy;
        this._tmp.known_names.add('tryto');
        tryto = (verb, ...P) => {
          if (!this.can(verb)) {
            return false;
          }
          this[verb](...P);
          return true;
        };
        //.......................................................................................................
        tryto_proxy = new Proxy(tryto, {
          get: function(target, key) {
            return function(...P) {
              return target(key, ...P);
            };
          }
        });
        //.......................................................................................................
        set(this, 'tryto', tryto_proxy);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_subfsms() {
        var fsm_names, ref, ref1, sub_fsmd, subfsm_name;
        fsm_names = [];
        ref1 = (ref = this._tmp.fsmd) != null ? ref : {};
        for (subfsm_name in ref1) {
          sub_fsmd = ref1[subfsm_name];
          if (this._tmp.known_names.has(subfsm_name)) {
            continue;
          }
          if (this._reserved_keys.has(subfsm_name)) {
            continue;
          }
          if (!isa.object(sub_fsmd)) {
            continue;
          }
          this._tmp.known_names.add(subfsm_name);
          sub_fsmd = {...sub_fsmd};
          if ((sub_fsmd.name != null) && sub_fsmd.name !== subfsm_name) {
            throw new Error(`^intermatic/_compile_subfsms@506^ name mismatch, got ${rpr(subfsm_name)}, ${rpr(sub_fsmd.name)}`);
          }
          sub_fsmd.name = subfsm_name;
          set(sub_fsmd, 'up', this);
          this._tmp.known_names.add(subfsm_name);
          fsm_names.push(subfsm_name);
          set(this, subfsm_name, new this.constructor(sub_fsmd));
        }
        this.fsm_names = freeze(fsm_names);
        this.has_subfsms = fsm_names.length > 0;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_cascades() {
        var cascades;
        this._tmp.known_names.add('cascades');
        if ((cascades = this._tmp.fsmd.cascades) == null) {
          return null;
        }
        this.cascades = new Set(cascades);
        return null;
      }

      // #---------------------------------------------------------------------------------------------------------
      // _compile_root_fsms: ->
      //   @_tmp.known_names.add 'root_fsm'
      //   debug '^3344^', @up?.name ? 'NULL'
      //   return unless ( @_root_fsm = @up )?
      //   @_root_fsm = root_fsm while ( root_fsm = root_fsm.up )?
      //   return null

        //---------------------------------------------------------------------------------------------------------
      _copy_other_attributes() {
        var pname, propd, ref;
        ref = Object.getOwnPropertyDescriptors(this._tmp.fsmd);
        for (pname in ref) {
          propd = ref[pname];
          if (this._tmp.known_names.has(pname)) {
            continue;
          }
          this._tmp.known_names.add(pname);
          // if ( pname is 'data' ) and ( isa.object propd.value ) and ( not propd.value.up? )
          //   Object.defineProperty propd.value, 'fsm', { enumerable: false, value: @, }
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
        enumerable: true,
        get: function() {
          return this._lstate;
        },
        set: function(lstate) {
          validate.lstate(lstate);
          this._prv_lstates = push_circular(this._prv_lstates, lstate, this.history_length + 1);
          return this._lstate = lstate;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      cstate: {
        enumerable: true,
        get: function() {
          var R, i, len, ref, subfsm_name, x;
          R = Object.assign({}, this.move);
          if ((x = this.path) != null) {
            R.path = x;
          }
          if ((x = this.data) != null) {
            R.data = freeze({...x});
          }
          ref = this.fsm_names;
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            R[subfsm_name] = this[subfsm_name].cstate;
          }
          return freeze(R);
        }
      },
      //-------------------------------------------------------------------------------------------------------
      EXP_dstate: {
        enumerable: true,
        get: function() {
          var R, i, len, ref, sub_fsm, subfsm_name, target;
          target = {
            lstate: this.lstate
          };
          R = {
            [this.name]: target
          };
          if (this.data != null) {
            target.data = this.data;
          }
          ref = this.fsm_names;
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            sub_fsm = this[subfsm_name];
            Object.assign(target, sub_fsm.EXP_dstate);
          }
          freeze(target);
          return freeze(R);
        }
      },
      //-------------------------------------------------------------------------------------------------------
      stage: {
        get: function() {
          return this._stage;
        }
      },
      verb: {
        get: function() {
          return this._nxt_verb;
        }
      },
      dpar: {
        get: function() {
          return this._nxt_dpar;
        }
      },
      dest: {
        get: function() {
          return this._nxt_dest;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      move: {
        get: function() {
          var R, x;
          R = {};
          if ((x = this.stage) != null) {
            R.stage = x;
          }
          if ((x = this.verb) != null) {
            R.verb = x;
          }
          if ((x = this.dpar) != null) {
            R.dpar = x;
          }
          if ((x = this.dest) != null) {
            R.dest = x;
          }
          if (((x = this.changed) != null) && x) {
            R.changed = x;
          }
          R.lstate = this.lstate;
          if ((this.dpar != null) && (this.dest == null)) {
            R.failed = true;
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
      changed: {
        get: function() {
          if (!((this._nxt_dpar != null) && (this._nxt_dest != null))) {
            return null;
          }
          return this._nxt_dpar !== this._nxt_dest;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      path: {
        get: function() {
          var R, ref;
          if ((R = this._path) != null) {
            return R;
          }
          return this._path = this.up != null ? `${this.up.path}/${this.name}` : (ref = this.name) != null ? ref : null;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      root_fsm: {
        get: function() {
          var R, root_fsm;
          if ((R = this._root_fsm) !== misfit) {
            return R;
          }
          if (this.up === null) {
            return this._root_fsm = null;
          }
          return this._root_fsm = (root_fsm = this.up.root_fsm) != null ? root_fsm : this.up;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      history: {
        get: function() {
          var R, dest, dpar, i, idx, len, ref, verb;
          R = [];
          ref = this._prv_verbs;
          for (idx = i = 0, len = ref.length; i < len; idx = ++i) {
            verb = ref[idx];
            dpar = this._prv_lstates[idx];
            dest = this._prv_lstates[idx + 1];
            R.push(freeze({verb, dpar, dest}));
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


},{"intertype":9}],3:[function(require,module,exports){

var type = require('./jkroso-type')

// (any, any, [array]) -> boolean
function equal(a, b, memos){
  // All identical values are equivalent
  if (a === b) return true
  var fnA = types[type(a)]
  var fnB = types[type(b)]
  return fnA && fnA === fnB
    ? fnA(a, b, memos)
    : false
}

var types = {}

// (Number) -> boolean
types.number = function(a, b){
  return a !== a && b !== b/*Nan check*/
}

// (function, function, array) -> boolean
types['function'] = function(a, b, memos){
  return a.toString() === b.toString()
    // Functions can act as objects
    && types.object(a, b, memos)
    && equal(a.prototype, b.prototype)
}

// (date, date) -> boolean
types.date = function(a, b){
  return +a === +b
}

// (regexp, regexp) -> boolean
types.regexp = function(a, b){
  return a.toString() === b.toString()
}

// (DOMElement, DOMElement) -> boolean
types.element = function(a, b){
  return a.outerHTML === b.outerHTML
}

// (textnode, textnode) -> boolean
types.textnode = function(a, b){
  return a.textContent === b.textContent
}

// decorate fn to prevent it re-checking objects
// (function) -> function
function memoGaurd(fn){
  return function(a, b, memos){
    if (!memos) return fn(a, b, [])
    var i = memos.length, memo
    while (memo = memos[--i]) {
      if (memo[0] === a && memo[1] === b) return true
    }
    return fn(a, b, memos)
  }
}

types['arguments'] =
types['bit-array'] =
types.array = memoGaurd(arrayEqual)

// (array, array, array) -> boolean
function arrayEqual(a, b, memos){
  var i = a.length
  if (i !== b.length) return false
  memos.push([a, b])
  while (i--) {
    if (!equal(a[i], b[i], memos)) return false
  }
  return true
}

types.object = memoGaurd(objectEqual)

// (object, object, array) -> boolean
function objectEqual(a, b, memos) {
  if (typeof a.equal == 'function') {
    memos.push([a, b])
    return a.equal(b, memos)
  }
  var ka = getEnumerableProperties(a)
  var kb = getEnumerableProperties(b)
  var i = ka.length

  // same number of properties
  if (i !== kb.length) return false

  // although not necessarily the same order
  ka.sort()
  kb.sort()

  // cheap key test
  while (i--) if (ka[i] !== kb[i]) return false

  // remember
  memos.push([a, b])

  // iterate again this time doing a thorough check
  i = ka.length
  while (i--) {
    var key = ka[i]
    if (!equal(a[key], b[key], memos)) return false
  }

  return true
}

// (object) -> array
function getEnumerableProperties (object) {
  var result = []
  for (var k in object) if (k !== 'constructor') {
    result.push(k)
  }
  return result
}

module.exports = equal


},{"./jkroso-type":4}],4:[function(require,module,exports){

var toString = {}.toString
var DomNode = typeof window != 'undefined'
  ? window.Node
  : Function // could be any function

/**
 * Return the type of val.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

module.exports = exports = function type(x){
  var type = typeof x
  if (type != 'object') return type
  type = types[toString.call(x)]
  if (type == 'object') {
    // in case they have been polyfilled
    if (x instanceof Map) return 'map'
    if (x instanceof Set) return 'set'
    return 'object'
  }
  if (type) return type
  if (x instanceof DomNode) switch (x.nodeType) {
    case 1:  return 'element'
    case 3:  return 'text-node'
    case 9:  return 'document'
    case 11: return 'document-fragment'
    default: return 'dom-node'
  }
}

var types = exports.types = {
  '[object Function]': 'function',
  '[object Date]': 'date',
  '[object RegExp]': 'regexp',
  '[object Arguments]': 'arguments',
  '[object Array]': 'array',
  '[object Set]': 'set',
  '[object String]': 'string',
  '[object Null]': 'null',
  '[object Undefined]': 'undefined',
  '[object Number]': 'number',
  '[object Boolean]': 'boolean',
  '[object Object]': 'object',
  '[object Map]': 'map',
  '[object Text]': 'text-node',
  '[object Uint8Array]': 'bit-array',
  '[object Uint16Array]': 'bit-array',
  '[object Uint32Array]': 'bit-array',
  '[object Uint8ClampedArray]': 'bit-array',
  '[object Error]': 'error',
  '[object FormData]': 'form-data',
  '[object File]': 'file',
  '[object Blob]': 'blob'
}


},{}],5:[function(require,module,exports){
(function() {
  'use strict';
  var js_type_of, rpr, sad;

  //###########################################################################################################
  this.sad = sad = Symbol('sad');

  ({rpr, js_type_of} = require('./helpers'));

  //-----------------------------------------------------------------------------------------------------------
  this.is_sad = function(x) {
    return (x === sad) || (x instanceof Error) || (this.is_saddened(x));
  };

  this.is_happy = function(x) {
    return !this.is_sad(x);
  };

  this.sadden = function(x) {
    return {
      [sad]: true,
      _: x
    };
  };

  this.is_saddened = function(x) {
    return ((js_type_of(x)) === 'object') && (x[sad] === true);
  };

  //-----------------------------------------------------------------------------------------------------------
  this.unsadden = function(x) {
    if (this.is_happy(x)) {
      return x;
    }
    this.validate.saddened(x);
    return x._;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.declare_check = function(name, checker) {
    this.validate.nonempty_text(name);
    this.validate.function(checker);
    if (this.specs[name] != null) {
      throw new Error(`µ8032 type ${rpr(name)} already declared`);
    }
    if (this.checks[name] != null) {
      throw new Error(`µ8033 check ${rpr(name)} already declared`);
    }
    this.checks[name] = checker;
    return null;
  };

}).call(this);


},{"./helpers":8}],6:[function(require,module,exports){
(function (Buffer){
(function() {
  //...........................................................................................................
  // { equals, }               = require 'cnd'
  var CHECKS, assign, jr, js_type_of, jsidentifier_pattern, xrpr,
    modulo = function(a, b) { return (+a % (b = +b) + b) % b; };

  ({assign, jr, xrpr, js_type_of} = require('./helpers'));

  CHECKS = require('./checks');

  /* thx to
    https://github.com/mathiasbynens/mothereff.in/blob/master/js-variables/eff.js
    https://mathiasbynens.be/notes/javascript-identifiers-es6
  */
  // jsidentifier_pattern      = /^(?:[\$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D])(?:[\$0-9A-Z_a-z\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF])*$/
  jsidentifier_pattern = /^(?:[$_]|\p{ID_Start})(?:[$_\u{200c}\u{200d}]|\p{ID_Continue})*$/u;

  //===========================================================================================================
  // TYPE DECLARATIONS
  //-----------------------------------------------------------------------------------------------------------
  this.declare_types = function() {
    /* NOTE to be called as `( require './declarations' ).declare_types.apply instance` */
    this.declare('null', (x) => {
      return x === null;
    });
    this.declare('undefined', (x) => {
      return x === void 0;
    });
    //.........................................................................................................
    this.declare('sad', (x) => {
      return CHECKS.is_sad(x);
    });
    this.declare('happy', (x) => {
      return CHECKS.is_happy(x);
    });
    this.declare('saddened', (x) => {
      return CHECKS.is_saddened(x);
    });
    this.declare('symbol', (x) => {
      return typeof x === 'symbol';
    });
    //.........................................................................................................
    this.declare('boolean', {
      tests: {
        "x is true or false": (x) => {
          return (x === true) || (x === false);
        }
      },
      casts: {
        float: (x) => {
          if (x) {
            return 1;
          } else {
            return 0;
          }
        }
      }
    });
    //.........................................................................................................
    this.declare('nan', (x) => {
      return Number.isNaN(x);
    });
    this.declare('finite', (x) => {
      return Number.isFinite(x);
    });
    this./* TAINT make sure no non-numbers slip through */declare('integer', (x) => {
      return Number.isInteger(x);
    });
    this./* TAINT make sure no non-numbers slip through */declare('safeinteger', (x) => {
      return Number.isSafeInteger(x);
    });
    //.........................................................................................................
    /* FTTB we are retaining `number` as a less-preferred synonym for `float`; in the future, `number` may
     be removed because it conflicts with JS usage (where it includes `NaN` and `+/-Infinity`) and, moreover,
     is not truthful (because it is a poor representation of what the modern understanding of 'number' in the
     mathematical sense would imply). */
    /* NOTE removed in v8: `@specs.number = @specs.float` */
    this./* TAINT make sure no non-numbers slip through */declare('number', (x) => {
      return false; // throw new Error "^intertype@84744^ type 'number' is deprecated"
    });
    this.declare('float', {
      tests: (x) => {
        return Number.isFinite(x);
      },
      casts: {
        boolean: (x) => {
          if (x === 0) {
            return false;
          } else {
            return true;
          }
        },
        integer: (x) => {
          return Math.round(x);
        }
      }
    });
    //.........................................................................................................
    this.declare('frozen', (x) => {
      return Object.isFrozen(x);
    });
    this.declare('sealed', (x) => {
      return Object.isSealed(x);
    });
    this.declare('extensible', (x) => {
      return Object.isExtensible(x);
    });
    //.........................................................................................................
    this.declare('numeric', (x) => {
      return (js_type_of(x)) === 'number';
    });
    this.declare('function', (x) => {
      return (js_type_of(x)) === 'function';
    });
    this.declare('asyncfunction', (x) => {
      return (js_type_of(x)) === 'asyncfunction';
    });
    this.declare('generatorfunction', (x) => {
      return (js_type_of(x)) === 'generatorfunction';
    });
    this.declare('asyncgeneratorfunction', (x) => {
      return (js_type_of(x)) === 'asyncgeneratorfunction';
    });
    this.declare('asyncgenerator', (x) => {
      return (js_type_of(x)) === 'asyncgenerator';
    });
    this.declare('generator', (x) => {
      return (js_type_of(x)) === 'generator';
    });
    this.declare('date', (x) => {
      return (js_type_of(x)) === 'date';
    });
    this.declare('listiterator', (x) => {
      return (js_type_of(x)) === 'arrayiterator';
    });
    this.declare('textiterator', (x) => {
      return (js_type_of(x)) === 'stringiterator';
    });
    this.declare('setiterator', (x) => {
      return (js_type_of(x)) === 'setiterator';
    });
    this.declare('mapiterator', (x) => {
      return (js_type_of(x)) === 'mapiterator';
    });
    this.declare('callable', (x) => {
      var ref;
      return (ref = this.type_of(x)) === 'function' || ref === 'asyncfunction' || ref === 'generatorfunction';
    });
    this.declare('promise', (x) => {
      return (this.isa.nativepromise(x)) || (this.isa.thenable(x));
    });
    this.declare('nativepromise', (x) => {
      return x instanceof Promise;
    });
    this.declare('thenable', (x) => {
      return (this.type_of(x != null ? x.then : void 0)) === 'function';
    });
    this.declare('immediate', function(x) {
      return !this.isa.promise(x);
    });
    //.........................................................................................................
    this.declare('truthy', (x) => {
      return !!x;
    });
    this.declare('falsy', (x) => {
      return !x;
    });
    this.declare('true', (x) => {
      return x === true;
    });
    this.declare('false', (x) => {
      return x === false;
    });
    this.declare('unset', (x) => {
      return x == null;
    });
    this.declare('notunset', (x) => {
      return x != null;
    });
    //.........................................................................................................
    this.declare('even', (x) => {
      return (this.isa.safeinteger(x)) && (modulo(x, 2)) === 0;
    });
    this.declare('odd', (x) => {
      return (this.isa.safeinteger(x)) && (modulo(x, 2)) === 1;
    });
    this.declare('cardinal', function(x) {
      return (this.isa.safeinteger(x)) && (this.isa.nonnegative(x));
    });
    this.declare('nonnegative', (x) => {
      return (this.isa.infloat(x)) && (x >= 0);
    });
    this.declare('positive', (x) => {
      return (this.isa.infloat(x)) && (x > 0);
    });
    this.declare('positive_float', (x) => {
      return (this.isa.float(x)) && (x > 0);
    });
    this.declare('positive_integer', (x) => {
      return (this.isa.integer(x)) && (x > 0);
    });
    this.declare('negative_integer', (x) => {
      return (this.isa.integer(x)) && (x < 0);
    });
    this.declare('zero', (x) => {
      return x === 0;
    });
    this.declare('infinity', (x) => {
      return (x === +2e308) || (x === -2e308);
    });
    this.declare('infloat', (x) => {
      return (this.isa.float(x)) || (x === 2e308) || (x === -2e308);
    });
    this.declare('nonpositive', (x) => {
      return (this.isa.infloat(x)) && (x <= 0);
    });
    this.declare('negative', (x) => {
      return (this.isa.infloat(x)) && (x < 0);
    });
    this.declare('negative_float', (x) => {
      return (this.isa.float(x)) && (x < 0);
    });
    this.declare('proper_fraction', (x) => {
      return (this.isa.float(x)) && ((0 <= x && x <= 1));
    });
    //.........................................................................................................
    this.declare('empty', function(x) {
      return (this.has_size(x)) && (this.size_of(x)) === 0;
    });
    this.declare('singular', function(x) {
      return (this.has_size(x)) && (this.size_of(x)) === 1;
    });
    this.declare('nonempty', function(x) {
      return (this.has_size(x)) && (this.size_of(x)) > 0;
    });
    this.declare('plural', function(x) {
      return (this.has_size(x)) && (this.size_of(x)) > 1;
    });
    this.declare('blank_text', function(x) {
      return (this.isa.text(x)) && ((x.match(/^\s*$/us)) != null);
    });
    this.declare('nonblank_text', function(x) {
      return (this.isa.text(x)) && ((x.match(/^\s*$/us)) == null);
    });
    this.declare('chr', function(x) {
      return (this.isa.text(x)) && ((x.match(/^.$/us)) != null);
    });
    this.declare('nonempty_text', function(x) {
      return (this.isa.text(x)) && (this.isa.nonempty(x));
    });
    this.declare('nonempty_list', function(x) {
      return (this.isa.list(x)) && (this.isa.nonempty(x));
    });
    this.declare('nonempty_object', function(x) {
      return (this.isa.object(x)) && (this.isa.nonempty(x));
    });
    this.declare('nonempty_set', function(x) {
      return (this.isa.set(x)) && (this.isa.nonempty(x));
    });
    this.declare('nonempty_map', function(x) {
      return (this.isa.map(x)) && (this.isa.nonempty(x));
    });
    this.declare('empty_text', function(x) {
      return (this.isa.text(x)) && (this.isa.empty(x));
    });
    this.declare('empty_list', function(x) {
      return (this.isa.list(x)) && (this.isa.empty(x));
    });
    this.declare('empty_object', function(x) {
      return (this.isa.object(x)) && (this.isa.empty(x));
    });
    this.declare('empty_set', function(x) {
      return (this.isa.set(x)) && (this.isa.empty(x));
    });
    this.declare('empty_map', function(x) {
      return (this.isa.map(x)) && (this.isa.empty(x));
    });
    // is_given                  = ( x ) -> not [ null, undefined, NaN, '', ].includes x
    //.........................................................................................................
    this.declare('buffer', {
      size: 'length'
    }, (x) => {
      return Buffer.isBuffer(x);
    });
    this.declare('arraybuffer', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'arraybuffer';
    });
    this.declare('int8array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'int8array';
    });
    this.declare('uint8array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'uint8array';
    });
    this.declare('uint8clampedarray', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'uint8clampedarray';
    });
    this.declare('int16array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'int16array';
    });
    this.declare('uint16array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'uint16array';
    });
    this.declare('int32array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'int32array';
    });
    this.declare('uint32array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'uint32array';
    });
    this.declare('float32array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'float32array';
    });
    this.declare('float64array', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'float64array';
    });
    this.declare('list', {
      size: 'length'
    }, (x) => {
      return (js_type_of(x)) === 'array';
    });
    this.declare('set', {
      size: 'size'
    }, function(x) {
      return (js_type_of(x)) === 'set';
    });
    this.declare('map', {
      size: 'size'
    }, function(x) {
      return (js_type_of(x)) === 'map';
    });
    this.declare('weakmap', function(x) {
      return (js_type_of(x)) === 'weakmap';
    });
    this.declare('weakset', function(x) {
      return (js_type_of(x)) === 'weakset';
    });
    this.declare('error', function(x) {
      return (js_type_of(x)) === 'error';
    });
    this.declare('regex', function(x) {
      return (js_type_of(x)) === 'regexp';
    });
    //.........................................................................................................
    this.declare('object', {
      tests: (x) => {
        return (js_type_of(x)) === 'object';
      },
      size: (x) => {
        return (Object.keys(x)).length;
      }
    });
    //.........................................................................................................
    this.declare('global', {
      tests: (x) => {
        return (js_type_of(x)) === 'global';
      },
      size: (x) => {
        return (Object.keys(x)).length;
      }
    });
    //.........................................................................................................
    this.declare('text', {
      tests: (x) => {
        return (js_type_of(x)) === 'string';
      },
      size: function(x, selector = 'codeunits') {
        var ref;
        switch (selector) {
          case 'codepoints':
            return (Array.from(x)).length;
          case 'codeunits':
            return x.length;
          case 'bytes':
            return Buffer.byteLength(x, (ref = typeof settings !== "undefined" && settings !== null ? settings['encoding'] : void 0) != null ? ref : 'utf-8');
          default:
            throw new Error(`unknown counting selector ${rpr(selector)}`);
        }
      }
    });
    //.........................................................................................................
    this.declare('list_of', {
      tests: {
        "x is a list": (type, x, ...xP) => {
          return this.isa.list(x);
        },
        /* TAINT should check for `@isa.type type` */
        "type is nonempty_text": (type, x, ...xP) => {
          return this.isa.nonempty_text(type);
        },
        "all elements pass test": (type, x, ...xP) => {
          return x.every((xx) => {
            return this.isa(type, xx, ...xP);
          });
        }
      }
    });
    //.........................................................................................................
    this.declare('object_of', {
      tests: {
        "x is a object": (type, x, ...xP) => {
          return this.isa.object(x);
        },
        /* TAINT should check for `@isa.type type` */
        "type is nonempty_text": (type, x, ...xP) => {
          return this.isa.nonempty_text(type);
        },
        "all elements pass test": (type, x, ...xP) => {
          var _, xx;
          for (_ in x) {
            xx = x[_];
            if (!this.isa(type, xx, ...xP)) {
              return false;
            }
          }
          return true;
        }
      }
    });
    //.........................................................................................................
    this.declare('jsidentifier', {
      tests: (x) => {
        return (this.isa.text(x)) && jsidentifier_pattern.test(x);
      }
    });
    //.........................................................................................................
    this.declare('int2text', {
      tests: (x) => {
        return (this.isa.text(x)) && ((x.match(/^[01]+$/)) != null);
      },
      casts: {
        float: (x) => {
          return parseInt(x, 2);
        }
      }
    });
    //.........................................................................................................
    this.declare('int10text', {
      tests: (x) => {
        return (this.isa.text(x)) && ((x.match(/^[0-9]+$/)) != null);
      },
      casts: {
        float: (x) => {
          return parseInt(x, 10);
        }
      }
    });
    //.........................................................................................................
    this.declare('int16text', {
      tests: (x) => {
        return (this.isa.text(x)) && ((x.match(/^[0-9a-fA-F]+$/)) != null);
      },
      casts: {
        float: (x) => {
          return parseInt(x, 16);
        },
        int2text: (x) => {
          return (parseInt(x, 16)).toString(2);
        }
      }
    });
    //.........................................................................................................
    this./* TAINT could use `cast()` API */declare('int32', function(x) {
      return (this.isa.integer(x)) && ((-2147483648 <= x && x <= 2147483647));
    });
    //.........................................................................................................
    this.declare('vnr', function(x) {
      /* A vectorial number (VNR) is a non-empty array of numbers, including infinity. */
      return (this.isa_list_of.infloat(x)) && (x.length > 0);
    });
    //.........................................................................................................
    return this.declare('fs_stats', {
      tests: {
        'x is an object': function(x) {
          return this.isa.object(x);
        },
        'x.size is a cardinal': function(x) {
          return this.isa.cardinal(x.size);
        },
        'x.atimeMs is a float': function(x) {
          return this.isa.float(x.atimeMs);
        },
        'x.atime is a date': function(x) {
          return this.isa.date(x.atime);
        }
      }
    });
  };

  //===========================================================================================================
  // TYPE DECLARATIONS
  //-----------------------------------------------------------------------------------------------------------
  this.declare_checks = function() {
    var FS, PATH;
    PATH = require('path');
    FS = require('fs');
    //.........................................................................................................
    /* NOTE: will throw error unless path exists, error is implicitly caught, represents sad path */
    this.declare_check('fso_exists', function(path, stats = null) {
      return FS.statSync(path);
    });
    // try ( stats ? FS.statSync path ) catch error then error
    //.........................................................................................................
    this.declare_check('is_file', function(path, stats = null) {
      var bad;
      if (this.is_sad((bad = stats = this.check.fso_exists(path, stats)))) {
        return bad;
      }
      if (stats.isFile()) {
        return stats;
      }
      return this.sadden(`not a file: ${path}`);
    });
    //.........................................................................................................
    return this.declare_check('is_json_file', function(path) {
      var error;
      try {
        return JSON.parse(FS.readFileSync(path));
      } catch (error1) {
        error = error1;
        return error;
      }
    });
  };

  // #.........................................................................................................
// @declare_check 'equals', ( a, P... ) ->
//   for b in P
//     return CHECKS.sad unless equals a, b
//   return true
/* not supported until we figure out how to do it in strict mode: */
// @declare 'arguments',                     ( x ) -> ( js_type_of x ) is 'arguments'

  // Array.isArray
// ArrayBuffer.isView
// Atomics.isLockFree
// Buffer.isBuffer
// Buffer.isEncoding
// constructor.is
// constructor.isExtensible
// constructor.isFrozen
// constructor.isSealed
// Number.isFinite
// Number.isInteger
// Number.isNaN
// Number.isSafeInteger
// Object.is
// Object.isExtensible
// Object.isFrozen
// Object.isSealed
// Reflect.isExtensible
// root.isFinite
// root.isNaN
// Symbol.isConcatSpreadable

}).call(this);


}).call(this,require("buffer").Buffer)
},{"./checks":5,"./helpers":8,"buffer":17,"fs":15,"path":20}],7:[function(require,module,exports){
(function (Buffer){
(function() {
  'use strict';
  var assign, constructor_of_generators, copy_if_original, isa_copy, jr, js_type_of, rpr, xrpr,
    indexOf = [].indexOf;

  //###########################################################################################################
  ({assign, jr, rpr, xrpr, js_type_of} = require('./helpers'));

  isa_copy = Symbol('isa_copy');

  constructor_of_generators = ((function*() {
    return (yield 42);
  })()).constructor;

  //-----------------------------------------------------------------------------------------------------------
  /* TAINT make catalog of all 'deep JS' names that must never be used as types, b/c e.g a type 'bind'
  would shadow native `f.bind()` */
  this.illegal_types = ['bind', 'toString', 'valueOf'];

  //-----------------------------------------------------------------------------------------------------------
  copy_if_original = function(x) {
    var R;
    if (x[isa_copy]) {
      return x;
    }
    R = assign({}, x);
    R[isa_copy] = true;
    return R;
  };

  //-----------------------------------------------------------------------------------------------------------
  this._satisfies_all_aspects = function(type, ...xP) {
    if ((this._get_unsatisfied_aspect(type, ...xP)) == null) {
      return true;
    }
    return false;
  };

  //-----------------------------------------------------------------------------------------------------------
  this._get_unsatisfied_aspect = function(type, ...xP) {
    var aspect, factual_type, ref, spec, test;
    /* Check with `type_of()` if type not in spec: */
    if ((spec = this.specs[type]) == null) {
      if ((factual_type = this.type_of(...xP)) === type) {
        return null;
      }
      return `${rpr(type)} is a known type`;
    }
    ref = spec.tests;
    /* Check all constraints in spec: */
    for (aspect in ref) {
      test = ref[aspect];
      if (!test.apply(this, xP)) {
        return aspect;
      }
    }
    return null;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.type_of = function(x) {
    var R, c, tagname;
    if (arguments.length !== 1) {
      throw new Error(`^7746^ expected 1 argument, got ${arity}`);
    }
    if (x === null) {
      return 'null';
    }
    if (x === void 0) {
      return 'undefined';
    }
    if ((x === 2e308) || (x === -2e308)) {
      return 'infinity';
    }
    if ((x === true) || (x === false)) {
      return 'boolean';
    }
    if (Number.isNaN(x)) {
      return 'nan';
    }
    if (Buffer.isBuffer(x)) {
      return 'buffer';
    }
    //.........................................................................................................
    if ((tagname = x[Symbol.toStringTag]) != null) {
      if (tagname === 'Array Iterator') {
        return 'arrayiterator';
      }
      if (tagname === 'String Iterator') {
        return 'stringiterator';
      }
      if (tagname === 'Map Iterator') {
        return 'mapiterator';
      }
      if (tagname === 'Set Iterator') {
        return 'setiterator';
      }
      return tagname.toLowerCase();
    }
    if ((c = x.constructor) === void 0) {
      //.........................................................................................................
      /* Domenic Denicola Device, see https://stackoverflow.com/a/30560581 */
      return 'nullobject';
    }
    if ((typeof c) !== 'function') {
      return 'object';
    }
    if ((R = c.name.toLowerCase()) === '') {
      if (x.constructor === constructor_of_generators) {
        return 'generator';
      }
      /* NOTE: throw error since this should never happen */
      return ((Object.prototype.toString.call(x)).slice(8, -1)).toLowerCase();
    }
    if ((typeof x === 'object') && (R === 'boolean' || R === 'number' || R === 'string')) {
//.........................................................................................................
/* Mark Miller Device */      return 'wrapper';
    }
    if (R === 'number') {
      return 'float';
    }
    if (R === 'regexp') {
      return 'regex';
    }
    if (R === 'string') {
      return 'text';
    }
    if (R === 'array') {
      return 'list';
    }
    if (R === 'function' && x.toString().startsWith('class ')) {
      /* thx to https://stackoverflow.com/a/29094209 */
      /* TAINT may produce an arbitrarily long throwaway string */
      return 'class';
    }
    return R;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.types_of = function(...xP) {
    var R, aspect, ok, ref, ref1, spec, test, type;
    R = [];
    ref = this.specs;
    for (type in ref) {
      spec = ref[type];
      ok = true;
      ref1 = spec.tests;
      for (aspect in ref1) {
        test = ref1[aspect];
        if (!test.apply(this, xP)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        R.push(type);
      }
    }
    return R;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.declare = function(...P)/* type, spec?, test? */ {
    var arity;
    switch (arity = P.length) {
      case 1:
        return this._declare_1(...P);
      case 2:
        return this._declare_2(...P);
      case 3:
        return this._declare_3(...P);
    }
    throw new Error(`µ6746 expected between 1 and 3 arguments, got ${arity}`);
  };

  //-----------------------------------------------------------------------------------------------------------
  this._declare_1 = function(spec) {
    var T;
    if ((T = js_type_of(spec)) !== 'object') {
      throw new Error(`µ6869 expected an object for spec, got a ${T}`);
    }
    //.........................................................................................................
    if ((T = js_type_of(spec.type)) !== 'string') {
      throw new Error(`µ6992 expected a text for spec.type, got a ${T}`);
    }
    //.........................................................................................................
    switch ((T = js_type_of(spec.tests))) {
      case 'function':
        spec.tests = {
          main: spec.tests
        };
        break;
      case 'object':
        null;
        break;
      default:
        throw new Error(`µ7115 expected an object for spec.tests, got a ${T}`);
    }
    //.........................................................................................................
    return this._declare(spec);
  };

  //-----------------------------------------------------------------------------------------------------------
  this._declare_2 = function(type, spec_or_test) {
    var T, spec;
    switch (T = js_type_of(spec_or_test)) {
      //.......................................................................................................
      case 'function':
        return this._declare_1({
          type,
          tests: {
            main: spec_or_test
          }
        });
      //.......................................................................................................
      case 'asyncfunction':
        throw "µ7238 asynchronous functions not yet supported";
    }
    //.........................................................................................................
    if (T !== 'object') {
      throw new Error(`µ7361 expected an object, got a ${T} for spec`);
    }
    //.........................................................................................................
    if ((spec_or_test.type != null) && (!spec_or_test.type === type)) {
      throw new Error(`µ7484 type declarations ${rpr(type)} and ${rpr(spec_or_test.type)} do not match`);
    }
    //.........................................................................................................
    spec = copy_if_original(spec_or_test);
    spec.type = type;
    return this._declare_1(spec);
  };

  //-----------------------------------------------------------------------------------------------------------
  this._declare_3 = function(type, spec, test) {
    var T;
    if ((T = js_type_of(spec)) !== 'object') {
      throw new Error(`µ7607 expected an object, got a ${T} for spec`);
    }
    //.........................................................................................................
    if ((T = js_type_of(test)) !== 'function') {
      throw new Error(`µ7730 expected a function for test, got a ${T}`);
    }
    //.........................................................................................................
    if (spec.tests != null) {
      throw new Error("µ7853 spec cannot have tests when tests are passed as argument");
    }
    //.........................................................................................................
    spec = copy_if_original(spec);
    spec.tests = {
      main: test
    };
    return this._declare_2(type, spec);
  };

  //-----------------------------------------------------------------------------------------------------------
  this._declare = function(spec) {
    var type;
    spec = copy_if_original(spec);
    delete spec[isa_copy];
    ({type} = spec);
    spec.type = type;
    //.........................................................................................................
    if (indexOf.call(this.illegal_types, type) >= 0) {
      throw new Error(`µ7976 ${rpr(type)} is not a legal type name`);
    }
    //.........................................................................................................
    if (this.specs[type] != null) {
      throw new Error(`µ8099 type ${rpr(type)} already declared`);
    }
    //.........................................................................................................
    this.specs[type] = spec;
    this.isa[type] = (...P) => {
      return this.isa(type, ...P);
    };
    // @validate[ type ]    = ( P... ) => @validate type, P...
    spec.size = this._sizeof_method_from_spec(type, spec);
    //.........................................................................................................
    return null;
  };

}).call(this);


}).call(this,{"isBuffer":require("../../../../../../../usr/local/lib/node_modules/browserify/node_modules/is-buffer/index.js")})
},{"../../../../../../../usr/local/lib/node_modules/browserify/node_modules/is-buffer/index.js":19,"./helpers":8}],8:[function(require,module,exports){
(function() {
  'use strict';
  var inspect, rpr,
    indexOf = [].indexOf;

  //-----------------------------------------------------------------------------------------------------------
  ({inspect} = require('util'));

  this.assign = Object.assign;

  // @jr           = JSON.stringify
  this.rpr = rpr = (require('../loupe.js')).inspect;

  this.xrpr = function(x) {
    return (rpr(x)).slice(0, 1025);
  };

  //===========================================================================================================
  // TYPE_OF FLAVORS
  //-----------------------------------------------------------------------------------------------------------
  this.domenic_denicola_device = function(x) {
    var ref, ref1;
    return (ref = x != null ? (ref1 = x.constructor) != null ? ref1.name : void 0 : void 0) != null ? ref : './.';
  };

  this.mark_miller_device = function(x) {
    return (Object.prototype.toString.call(x)).slice(8, -1);
  };

  // @mark_miller_device       = ( x ) -> ( ( Object::toString.call x ).slice 8, -1 ).toLowerCase().replace /\s+/g, ''
  this.js_type_of = function(x) {
    return ((Object.prototype.toString.call(x)).slice(8, -1)).toLowerCase().replace(/\s+/g, '');
  };

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  this.get_rprs_of_tprs = function(tprs) {
    /* `tprs: test parameters, i.e. additional arguments to type tester, as in `multiple_of x, 4` */
    var rpr_of_tprs, srpr_of_tprs;
    rpr_of_tprs = (function() {
      switch (tprs.length) {
        case 0:
          return '';
        case 1:
          return `${rpr(tprs[0])}`;
        default:
          return `${rpr(tprs)}`;
      }
    })();
    srpr_of_tprs = (function() {
      switch (rpr_of_tprs.length) {
        case 0:
          return '';
        default:
          return ' ' + rpr_of_tprs;
      }
    })();
    return {rpr_of_tprs, srpr_of_tprs};
  };

  //-----------------------------------------------------------------------------------------------------------
  this.intersection_of = function(a, b) {
    var x;
    a = [...a].sort();
    b = [...b].sort();
    return ((function() {
      var i, len, results;
      results = [];
      for (i = 0, len = a.length; i < len; i++) {
        x = a[i];
        if (indexOf.call(b, x) >= 0) {
          results.push(x);
        }
      }
      return results;
    })()).sort();
  };

}).call(this);


},{"../loupe.js":12,"util":24}],9:[function(require,module,exports){
(function() {
  'use strict';
  // do =>
  //   INTERTYPE = require './main.js'
  //   if globalThis.window?
  //     globalThis.Intertype = INTERTYPE.Intertype
  //   else
  //     module.exports = INTERTYPE
  //   return null
  module.exports = require('./main.js');

}).call(this);


},{"./main.js":10}],10:[function(require,module,exports){
(function() {
  'use strict';
  var Multimix, assign, cast, check, declarations, get_rprs_of_tprs, isa, isa_list_of, isa_object_of, isa_optional, jk_equals, jr, js_type_of, rpr, sad, validate, validate_list_of, validate_object_of, validate_optional, xrpr;

  //###########################################################################################################
  Multimix = require('multimix');

  //...........................................................................................................
  ({assign, jr, rpr, xrpr, get_rprs_of_tprs, js_type_of} = require('./helpers'));

  //...........................................................................................................
  declarations = require('./declarations');

  sad = (require('./checks')).sad;

  jk_equals = require('../deps/jkroso-equals');

  //-----------------------------------------------------------------------------------------------------------
  isa = function(type, ...xP) {
    return this._satisfies_all_aspects(type, ...xP);
  };

  isa_list_of = function(type, ...xP) {
    return this.isa.list_of(type, ...xP);
  };

  isa_object_of = function(type, ...xP) {
    return this.isa.object_of(type, ...xP);
  };

  validate_list_of = function(type, ...xP) {
    return this.validate.list_of(type, ...xP);
  };

  validate_object_of = function(type, ...xP) {
    return this.validate.object_of(type, ...xP);
  };

  isa_optional = function(type, ...xP) {
    return (xP[0] == null) || this._satisfies_all_aspects(type, ...xP);
  };

  validate_optional = function(type, ...xP) {
    return (xP[0] == null) || this.validate(type, ...xP);
  };

  //-----------------------------------------------------------------------------------------------------------
  cast = function(type_a, type_b, x, ...xP) {
    var casts, converter;
    this.validate(type_a, x, ...xP);
    if (type_a === type_b) {
      return x;
    }
    if (this.isa(type_b, x, ...xP)) {
      return x;
    }
    if ((casts = this.specs[type_a].casts) != null) {
      if ((converter = casts[type_b]) != null) {
        return converter.call(this, x, ...xP);
      }
    }
    if (type_b === 'text'/* TAINT use better method like util.inspect */) {
      return `${x}`;
    }
    throw new Error(`^intertype/cast@1234^ unable to cast a ${type_a} as ${type_b}`);
  };

  //-----------------------------------------------------------------------------------------------------------
  check = function(type, x, ...xP) {
    var error;
    if (this.specs[type] != null) {
      if (this.isa(type, x, ...xP)) {
        return true;
      } else {
        return sad;
      }
    }
    if ((check = this.checks[type]) == null) {
      throw new Error(`^intertype/check@1345^ unknown type or check ${rpr(type)}`);
    }
    try {
      return check.call(this, x, ...xP);
    } catch (error1) {
      error = error1;
      return error;
    }
  };

  //-----------------------------------------------------------------------------------------------------------
  validate = function(type, ...xP) {
    var P, aspect, message, rpr_of_tprs, srpr_of_tprs, x;
    if ((aspect = this._get_unsatisfied_aspect(type, ...xP)) == null) {
      return true;
    }
    [x, ...P] = xP;
    ({rpr_of_tprs, srpr_of_tprs} = get_rprs_of_tprs(P));
    message = aspect === 'main' ? `^intertype/validate@1456^ not a valid ${type}: ${xrpr(x)}${srpr_of_tprs}` : `^intertype/validate@1567^ not a valid ${type} (violates ${rpr(aspect)}): ${xrpr(x)}${srpr_of_tprs}`;
    throw new Error(message);
  };

  //===========================================================================================================
  this.Intertype = (function() {
    class Intertype extends Multimix {
      //---------------------------------------------------------------------------------------------------------
      constructor(target = null) {
        super();
        //.......................................................................................................
        /* TAINT bug in MultiMix, should be possible to declare methods in class, not the constructor,
           and still get a bound version with `export()`; declaring them here FTTB */
        //.......................................................................................................
        this.sad = sad;
        this.specs = {};
        this.checks = {};
        this.isa = Multimix.get_keymethod_proxy(this, isa);
        this.isa_optional = Multimix.get_keymethod_proxy(this, isa_optional);
        this.isa_list_of = Multimix.get_keymethod_proxy(this, isa_list_of);
        this.isa_object_of = Multimix.get_keymethod_proxy(this, isa_object_of);
        this.cast = Multimix.get_keymethod_proxy(this, cast);
        this.validate = Multimix.get_keymethod_proxy(this, validate);
        this.validate_optional = Multimix.get_keymethod_proxy(this, validate_optional);
        this.validate_list_of = Multimix.get_keymethod_proxy(this, validate_list_of);
        this.validate_object_of = Multimix.get_keymethod_proxy(this, validate_object_of);
        this.check = Multimix.get_keymethod_proxy(this, check);
        this.nowait = function(x) {
          this.validate.immediate(x);
          return x;
        };
        declarations.declare_types.apply(this);
        declarations.declare_checks.apply(this);
        if (target != null) {
          this.export(target);
        }
      }

      //---------------------------------------------------------------------------------------------------------
      equals(a, ...P) {
        var arity, b, i, len, type_of_a;
        if ((arity = arguments.length) < 2) {
          throw new Error(`^intertype/equals@3489^ expected at least 2 arguments, got ${arity}`);
        }
        type_of_a = this.type_of(a);
        for (i = 0, len = P.length; i < len; i++) {
          b = P[i];
          if (type_of_a !== this.type_of(b)) {
            return false;
          }
          if (!jk_equals(a, b)) {
            /* TAINT this call involves its own typechecking code and thus may mysteriously fail */
            return false;
          }
        }
        return true;
      }

    };

    // @extend   object_with_class_properties
    Intertype.include(require('./sizing'));

    Intertype.include(require('./declaring'));

    Intertype.include(require('./checks'));

    return Intertype;

  }).call(this);

}).call(this);


},{"../deps/jkroso-equals":3,"./checks":5,"./declarations":6,"./declaring":7,"./helpers":8,"./sizing":11,"multimix":14}],11:[function(require,module,exports){
(function() {
  'use strict';
  var assign, jr, js_type_of, xrpr;

  //###########################################################################################################
  ({assign, jr, xrpr, js_type_of} = require('./helpers'));

  //===========================================================================================================
  // OBJECT SIZES
  //-----------------------------------------------------------------------------------------------------------
  this._sizeof_method_from_spec = function(type, spec) {
    return ((s) => {
      var T;
      if (s == null) {
        return null;
      }
      switch (T = js_type_of(s)) {
        case 'string':
          return function(x) {
            return x[s];
          };
        case 'function':
          return s/* TAINT disallows async funtions */;
        case 'number':
          return function() {
            return s/* TAINT allows NaN, Infinity */;
          };
      }
      throw new Error(`µ30988 expected null, a text or a function for size of ${type}, got a ${T}`);
    })(spec.size);
  };

  //-----------------------------------------------------------------------------------------------------------
  this.size_of = function(x, ...P) {
    /* The `size_of()` method uses a per-type configurable methodology to return the size of a given value;
     such methodology may permit or necessitate passing additional arguments (such as `size_of text`, which
     comes in several flavors depending on whether bytes or codepoints are to be counted). As such, it is a
     model for how to implement Go-like method dispatching. */
    var getter, ref, type;
    type = this.type_of(x);
    if (!(this.isa.function((getter = (ref = this.specs[type]) != null ? ref.size : void 0)))) {
      throw new Error(`µ88793 unable to get size of a ${type}`);
    }
    return getter(x, ...P);
  };

  //-----------------------------------------------------------------------------------------------------------
  /* TAINT faulty implementation:
   * does not use size_of but length
   * does not accept additional arguments as needed for texts
   * risks to break codepoints apart
    */
  this.first_of = function(collection) {
    return collection[0];
  };

  this.last_of = function(collection) {
    return collection[collection.length - 1];
  };

  //-----------------------------------------------------------------------------------------------------------
  this.arity_of = function(x) {
    var type;
    if ((type = this.supertype_of(x)) !== 'callable') {
      throw new Error(`µ88733 expected a callable, got a ${type}`);
    }
    return x.length;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.has_size = function(x) {
    var ref;
    return this.isa.function((ref = this.specs[this.type_of(x)]) != null ? ref.size : void 0);
  };

}).call(this);


},{"./helpers":8}],12:[function(require,module,exports){
(function (process,global,Buffer){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.loupe = {}));
}(this, (function (exports) { 'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var typeDetect = createCommonjsModule(function (module, exports) {
	(function (global, factory) {
		 module.exports = factory() ;
	}(commonjsGlobal, (function () {
	/* !
	 * type-detect
	 * Copyright(c) 2013 jake luer <jake@alogicalparadox.com>
	 * MIT Licensed
	 */
	var promiseExists = typeof Promise === 'function';

	/* eslint-disable no-undef */
	var globalObject = typeof self === 'object' ? self : commonjsGlobal; // eslint-disable-line id-blacklist

	var symbolExists = typeof Symbol !== 'undefined';
	var mapExists = typeof Map !== 'undefined';
	var setExists = typeof Set !== 'undefined';
	var weakMapExists = typeof WeakMap !== 'undefined';
	var weakSetExists = typeof WeakSet !== 'undefined';
	var dataViewExists = typeof DataView !== 'undefined';
	var symbolIteratorExists = symbolExists && typeof Symbol.iterator !== 'undefined';
	var symbolToStringTagExists = symbolExists && typeof Symbol.toStringTag !== 'undefined';
	var setEntriesExists = setExists && typeof Set.prototype.entries === 'function';
	var mapEntriesExists = mapExists && typeof Map.prototype.entries === 'function';
	var setIteratorPrototype = setEntriesExists && Object.getPrototypeOf(new Set().entries());
	var mapIteratorPrototype = mapEntriesExists && Object.getPrototypeOf(new Map().entries());
	var arrayIteratorExists = symbolIteratorExists && typeof Array.prototype[Symbol.iterator] === 'function';
	var arrayIteratorPrototype = arrayIteratorExists && Object.getPrototypeOf([][Symbol.iterator]());
	var stringIteratorExists = symbolIteratorExists && typeof String.prototype[Symbol.iterator] === 'function';
	var stringIteratorPrototype = stringIteratorExists && Object.getPrototypeOf(''[Symbol.iterator]());
	var toStringLeftSliceLength = 8;
	var toStringRightSliceLength = -1;
	/**
	 * ### typeOf (obj)
	 *
	 * Uses `Object.prototype.toString` to determine the type of an object,
	 * normalising behaviour across engine versions & well optimised.
	 *
	 * @param {Mixed} object
	 * @return {String} object type
	 * @api public
	 */
	function typeDetect(obj) {
	  /* ! Speed optimisation
	   * Pre:
	   *   string literal     x 3,039,035 ops/sec ±1.62% (78 runs sampled)
	   *   boolean literal    x 1,424,138 ops/sec ±4.54% (75 runs sampled)
	   *   number literal     x 1,653,153 ops/sec ±1.91% (82 runs sampled)
	   *   undefined          x 9,978,660 ops/sec ±1.92% (75 runs sampled)
	   *   function           x 2,556,769 ops/sec ±1.73% (77 runs sampled)
	   * Post:
	   *   string literal     x 38,564,796 ops/sec ±1.15% (79 runs sampled)
	   *   boolean literal    x 31,148,940 ops/sec ±1.10% (79 runs sampled)
	   *   number literal     x 32,679,330 ops/sec ±1.90% (78 runs sampled)
	   *   undefined          x 32,363,368 ops/sec ±1.07% (82 runs sampled)
	   *   function           x 31,296,870 ops/sec ±0.96% (83 runs sampled)
	   */
	  var typeofObj = typeof obj;
	  if (typeofObj !== 'object') {
	    return typeofObj;
	  }

	  /* ! Speed optimisation
	   * Pre:
	   *   null               x 28,645,765 ops/sec ±1.17% (82 runs sampled)
	   * Post:
	   *   null               x 36,428,962 ops/sec ±1.37% (84 runs sampled)
	   */
	  if (obj === null) {
	    return 'null';
	  }

	  /* ! Spec Conformance
	   * Test: `Object.prototype.toString.call(window)``
	   *  - Node === "[object global]"
	   *  - Chrome === "[object global]"
	   *  - Firefox === "[object Window]"
	   *  - PhantomJS === "[object Window]"
	   *  - Safari === "[object Window]"
	   *  - IE 11 === "[object Window]"
	   *  - IE Edge === "[object Window]"
	   * Test: `Object.prototype.toString.call(this)``
	   *  - Chrome Worker === "[object global]"
	   *  - Firefox Worker === "[object DedicatedWorkerGlobalScope]"
	   *  - Safari Worker === "[object DedicatedWorkerGlobalScope]"
	   *  - IE 11 Worker === "[object WorkerGlobalScope]"
	   *  - IE Edge Worker === "[object WorkerGlobalScope]"
	   */
	  if (obj === globalObject) {
	    return 'global';
	  }

	  /* ! Speed optimisation
	   * Pre:
	   *   array literal      x 2,888,352 ops/sec ±0.67% (82 runs sampled)
	   * Post:
	   *   array literal      x 22,479,650 ops/sec ±0.96% (81 runs sampled)
	   */
	  if (
	    Array.isArray(obj) &&
	    (symbolToStringTagExists === false || !(Symbol.toStringTag in obj))
	  ) {
	    return 'Array';
	  }

	  // Not caching existence of `window` and related properties due to potential
	  // for `window` to be unset before tests in quasi-browser environments.
	  if (typeof window === 'object' && window !== null) {
	    /* ! Spec Conformance
	     * (https://html.spec.whatwg.org/multipage/browsers.html#location)
	     * WhatWG HTML$7.7.3 - The `Location` interface
	     * Test: `Object.prototype.toString.call(window.location)``
	     *  - IE <=11 === "[object Object]"
	     *  - IE Edge <=13 === "[object Object]"
	     */
	    if (typeof window.location === 'object' && obj === window.location) {
	      return 'Location';
	    }

	    /* ! Spec Conformance
	     * (https://html.spec.whatwg.org/#document)
	     * WhatWG HTML$3.1.1 - The `Document` object
	     * Note: Most browsers currently adher to the W3C DOM Level 2 spec
	     *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-26809268)
	     *       which suggests that browsers should use HTMLTableCellElement for
	     *       both TD and TH elements. WhatWG separates these.
	     *       WhatWG HTML states:
	     *         > For historical reasons, Window objects must also have a
	     *         > writable, configurable, non-enumerable property named
	     *         > HTMLDocument whose value is the Document interface object.
	     * Test: `Object.prototype.toString.call(document)``
	     *  - Chrome === "[object HTMLDocument]"
	     *  - Firefox === "[object HTMLDocument]"
	     *  - Safari === "[object HTMLDocument]"
	     *  - IE <=10 === "[object Document]"
	     *  - IE 11 === "[object HTMLDocument]"
	     *  - IE Edge <=13 === "[object HTMLDocument]"
	     */
	    if (typeof window.document === 'object' && obj === window.document) {
	      return 'Document';
	    }

	    if (typeof window.navigator === 'object') {
	      /* ! Spec Conformance
	       * (https://html.spec.whatwg.org/multipage/webappapis.html#mimetypearray)
	       * WhatWG HTML$8.6.1.5 - Plugins - Interface MimeTypeArray
	       * Test: `Object.prototype.toString.call(navigator.mimeTypes)``
	       *  - IE <=10 === "[object MSMimeTypesCollection]"
	       */
	      if (typeof window.navigator.mimeTypes === 'object' &&
	          obj === window.navigator.mimeTypes) {
	        return 'MimeTypeArray';
	      }

	      /* ! Spec Conformance
	       * (https://html.spec.whatwg.org/multipage/webappapis.html#pluginarray)
	       * WhatWG HTML$8.6.1.5 - Plugins - Interface PluginArray
	       * Test: `Object.prototype.toString.call(navigator.plugins)``
	       *  - IE <=10 === "[object MSPluginsCollection]"
	       */
	      if (typeof window.navigator.plugins === 'object' &&
	          obj === window.navigator.plugins) {
	        return 'PluginArray';
	      }
	    }

	    if ((typeof window.HTMLElement === 'function' ||
	        typeof window.HTMLElement === 'object') &&
	        obj instanceof window.HTMLElement) {
	      /* ! Spec Conformance
	      * (https://html.spec.whatwg.org/multipage/webappapis.html#pluginarray)
	      * WhatWG HTML$4.4.4 - The `blockquote` element - Interface `HTMLQuoteElement`
	      * Test: `Object.prototype.toString.call(document.createElement('blockquote'))``
	      *  - IE <=10 === "[object HTMLBlockElement]"
	      */
	      if (obj.tagName === 'BLOCKQUOTE') {
	        return 'HTMLQuoteElement';
	      }

	      /* ! Spec Conformance
	       * (https://html.spec.whatwg.org/#htmltabledatacellelement)
	       * WhatWG HTML$4.9.9 - The `td` element - Interface `HTMLTableDataCellElement`
	       * Note: Most browsers currently adher to the W3C DOM Level 2 spec
	       *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-82915075)
	       *       which suggests that browsers should use HTMLTableCellElement for
	       *       both TD and TH elements. WhatWG separates these.
	       * Test: Object.prototype.toString.call(document.createElement('td'))
	       *  - Chrome === "[object HTMLTableCellElement]"
	       *  - Firefox === "[object HTMLTableCellElement]"
	       *  - Safari === "[object HTMLTableCellElement]"
	       */
	      if (obj.tagName === 'TD') {
	        return 'HTMLTableDataCellElement';
	      }

	      /* ! Spec Conformance
	       * (https://html.spec.whatwg.org/#htmltableheadercellelement)
	       * WhatWG HTML$4.9.9 - The `td` element - Interface `HTMLTableHeaderCellElement`
	       * Note: Most browsers currently adher to the W3C DOM Level 2 spec
	       *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-82915075)
	       *       which suggests that browsers should use HTMLTableCellElement for
	       *       both TD and TH elements. WhatWG separates these.
	       * Test: Object.prototype.toString.call(document.createElement('th'))
	       *  - Chrome === "[object HTMLTableCellElement]"
	       *  - Firefox === "[object HTMLTableCellElement]"
	       *  - Safari === "[object HTMLTableCellElement]"
	       */
	      if (obj.tagName === 'TH') {
	        return 'HTMLTableHeaderCellElement';
	      }
	    }
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   Float64Array       x 625,644 ops/sec ±1.58% (80 runs sampled)
	  *   Float32Array       x 1,279,852 ops/sec ±2.91% (77 runs sampled)
	  *   Uint32Array        x 1,178,185 ops/sec ±1.95% (83 runs sampled)
	  *   Uint16Array        x 1,008,380 ops/sec ±2.25% (80 runs sampled)
	  *   Uint8Array         x 1,128,040 ops/sec ±2.11% (81 runs sampled)
	  *   Int32Array         x 1,170,119 ops/sec ±2.88% (80 runs sampled)
	  *   Int16Array         x 1,176,348 ops/sec ±5.79% (86 runs sampled)
	  *   Int8Array          x 1,058,707 ops/sec ±4.94% (77 runs sampled)
	  *   Uint8ClampedArray  x 1,110,633 ops/sec ±4.20% (80 runs sampled)
	  * Post:
	  *   Float64Array       x 7,105,671 ops/sec ±13.47% (64 runs sampled)
	  *   Float32Array       x 5,887,912 ops/sec ±1.46% (82 runs sampled)
	  *   Uint32Array        x 6,491,661 ops/sec ±1.76% (79 runs sampled)
	  *   Uint16Array        x 6,559,795 ops/sec ±1.67% (82 runs sampled)
	  *   Uint8Array         x 6,463,966 ops/sec ±1.43% (85 runs sampled)
	  *   Int32Array         x 5,641,841 ops/sec ±3.49% (81 runs sampled)
	  *   Int16Array         x 6,583,511 ops/sec ±1.98% (80 runs sampled)
	  *   Int8Array          x 6,606,078 ops/sec ±1.74% (81 runs sampled)
	  *   Uint8ClampedArray  x 6,602,224 ops/sec ±1.77% (83 runs sampled)
	  */
	  var stringTag = (symbolToStringTagExists && obj[Symbol.toStringTag]);
	  if (typeof stringTag === 'string') {
	    return stringTag;
	  }

	  var objPrototype = Object.getPrototypeOf(obj);
	  /* ! Speed optimisation
	  * Pre:
	  *   regex literal      x 1,772,385 ops/sec ±1.85% (77 runs sampled)
	  *   regex constructor  x 2,143,634 ops/sec ±2.46% (78 runs sampled)
	  * Post:
	  *   regex literal      x 3,928,009 ops/sec ±0.65% (78 runs sampled)
	  *   regex constructor  x 3,931,108 ops/sec ±0.58% (84 runs sampled)
	  */
	  if (objPrototype === RegExp.prototype) {
	    return 'RegExp';
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   date               x 2,130,074 ops/sec ±4.42% (68 runs sampled)
	  * Post:
	  *   date               x 3,953,779 ops/sec ±1.35% (77 runs sampled)
	  */
	  if (objPrototype === Date.prototype) {
	    return 'Date';
	  }

	  /* ! Spec Conformance
	   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-promise.prototype-@@tostringtag)
	   * ES6$25.4.5.4 - Promise.prototype[@@toStringTag] should be "Promise":
	   * Test: `Object.prototype.toString.call(Promise.resolve())``
	   *  - Chrome <=47 === "[object Object]"
	   *  - Edge <=20 === "[object Object]"
	   *  - Firefox 29-Latest === "[object Promise]"
	   *  - Safari 7.1-Latest === "[object Promise]"
	   */
	  if (promiseExists && objPrototype === Promise.prototype) {
	    return 'Promise';
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   set                x 2,222,186 ops/sec ±1.31% (82 runs sampled)
	  * Post:
	  *   set                x 4,545,879 ops/sec ±1.13% (83 runs sampled)
	  */
	  if (setExists && objPrototype === Set.prototype) {
	    return 'Set';
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   map                x 2,396,842 ops/sec ±1.59% (81 runs sampled)
	  * Post:
	  *   map                x 4,183,945 ops/sec ±6.59% (82 runs sampled)
	  */
	  if (mapExists && objPrototype === Map.prototype) {
	    return 'Map';
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   weakset            x 1,323,220 ops/sec ±2.17% (76 runs sampled)
	  * Post:
	  *   weakset            x 4,237,510 ops/sec ±2.01% (77 runs sampled)
	  */
	  if (weakSetExists && objPrototype === WeakSet.prototype) {
	    return 'WeakSet';
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   weakmap            x 1,500,260 ops/sec ±2.02% (78 runs sampled)
	  * Post:
	  *   weakmap            x 3,881,384 ops/sec ±1.45% (82 runs sampled)
	  */
	  if (weakMapExists && objPrototype === WeakMap.prototype) {
	    return 'WeakMap';
	  }

	  /* ! Spec Conformance
	   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-dataview.prototype-@@tostringtag)
	   * ES6$24.2.4.21 - DataView.prototype[@@toStringTag] should be "DataView":
	   * Test: `Object.prototype.toString.call(new DataView(new ArrayBuffer(1)))``
	   *  - Edge <=13 === "[object Object]"
	   */
	  if (dataViewExists && objPrototype === DataView.prototype) {
	    return 'DataView';
	  }

	  /* ! Spec Conformance
	   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%mapiteratorprototype%-@@tostringtag)
	   * ES6$23.1.5.2.2 - %MapIteratorPrototype%[@@toStringTag] should be "Map Iterator":
	   * Test: `Object.prototype.toString.call(new Map().entries())``
	   *  - Edge <=13 === "[object Object]"
	   */
	  if (mapExists && objPrototype === mapIteratorPrototype) {
	    return 'Map Iterator';
	  }

	  /* ! Spec Conformance
	   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%setiteratorprototype%-@@tostringtag)
	   * ES6$23.2.5.2.2 - %SetIteratorPrototype%[@@toStringTag] should be "Set Iterator":
	   * Test: `Object.prototype.toString.call(new Set().entries())``
	   *  - Edge <=13 === "[object Object]"
	   */
	  if (setExists && objPrototype === setIteratorPrototype) {
	    return 'Set Iterator';
	  }

	  /* ! Spec Conformance
	   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%arrayiteratorprototype%-@@tostringtag)
	   * ES6$22.1.5.2.2 - %ArrayIteratorPrototype%[@@toStringTag] should be "Array Iterator":
	   * Test: `Object.prototype.toString.call([][Symbol.iterator]())``
	   *  - Edge <=13 === "[object Object]"
	   */
	  if (arrayIteratorExists && objPrototype === arrayIteratorPrototype) {
	    return 'Array Iterator';
	  }

	  /* ! Spec Conformance
	   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%stringiteratorprototype%-@@tostringtag)
	   * ES6$21.1.5.2.2 - %StringIteratorPrototype%[@@toStringTag] should be "String Iterator":
	   * Test: `Object.prototype.toString.call(''[Symbol.iterator]())``
	   *  - Edge <=13 === "[object Object]"
	   */
	  if (stringIteratorExists && objPrototype === stringIteratorPrototype) {
	    return 'String Iterator';
	  }

	  /* ! Speed optimisation
	  * Pre:
	  *   object from null   x 2,424,320 ops/sec ±1.67% (76 runs sampled)
	  * Post:
	  *   object from null   x 5,838,000 ops/sec ±0.99% (84 runs sampled)
	  */
	  if (objPrototype === null) {
	    return 'Object';
	  }

	  return Object
	    .prototype
	    .toString
	    .call(obj)
	    .slice(toStringLeftSliceLength, toStringRightSliceLength);
	}

	return typeDetect;

	})));
	});

	function _slicedToArray(arr, i) {
	  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
	}

	function _arrayWithHoles(arr) {
	  if (Array.isArray(arr)) return arr;
	}

	function _iterableToArrayLimit(arr, i) {
	  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
	  var _arr = [];
	  var _n = true;
	  var _d = false;
	  var _e = undefined;

	  try {
	    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
	      _arr.push(_s.value);

	      if (i && _arr.length === i) break;
	    }
	  } catch (err) {
	    _d = true;
	    _e = err;
	  } finally {
	    try {
	      if (!_n && _i["return"] != null) _i["return"]();
	    } finally {
	      if (_d) throw _e;
	    }
	  }

	  return _arr;
	}

	function _unsupportedIterableToArray(o, minLen) {
	  if (!o) return;
	  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
	  var n = Object.prototype.toString.call(o).slice(8, -1);
	  if (n === "Object" && o.constructor) n = o.constructor.name;
	  if (n === "Map" || n === "Set") return Array.from(n);
	  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
	}

	function _arrayLikeToArray(arr, len) {
	  if (len == null || len > arr.length) len = arr.length;

	  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

	  return arr2;
	}

	function _nonIterableRest() {
	  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}

	var ansiColors = {
	  bold: ['1', '22'],
	  dim: ['2', '22'],
	  italic: ['3', '23'],
	  underline: ['4', '24'],
	  // 5 & 6 are blinking
	  inverse: ['7', '27'],
	  hidden: ['8', '28'],
	  strike: ['9', '29'],
	  // 10-20 are fonts
	  // 21-29 are resets for 1-9
	  black: ['30', '39'],
	  red: ['31', '39'],
	  green: ['32', '39'],
	  yellow: ['33', '39'],
	  blue: ['34', '39'],
	  magenta: ['35', '39'],
	  cyan: ['36', '39'],
	  white: ['37', '39'],
	  brightblack: ['30;1', '39'],
	  brightred: ['31;1', '39'],
	  brightgreen: ['32;1', '39'],
	  brightyellow: ['33;1', '39'],
	  brightblue: ['34;1', '39'],
	  brightmagenta: ['35;1', '39'],
	  brightcyan: ['36;1', '39'],
	  brightwhite: ['37;1', '39'],
	  grey: ['90', '39']
	};
	var styles = {
	  special: 'cyan',
	  number: 'yellow',
	  boolean: 'yellow',
	  undefined: 'grey',
	  null: 'bold',
	  string: 'green',
	  symbol: 'green',
	  date: 'magenta',
	  regexp: 'red'
	};
	var truncator = '…';

	function colorise(value, styleType) {
	  var color = ansiColors[styles[styleType]] || ansiColors[styleType];

	  if (!color) {
	    return String(value);
	  }

	  return "\x1B[".concat(color[0], "m").concat(String(value), "\x1B[").concat(color[1], "m");
	}

	function normaliseOptions() {
	  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
	      _ref$showHidden = _ref.showHidden,
	      showHidden = _ref$showHidden === void 0 ? false : _ref$showHidden,
	      _ref$depth = _ref.depth,
	      depth = _ref$depth === void 0 ? 2 : _ref$depth,
	      _ref$colors = _ref.colors,
	      colors = _ref$colors === void 0 ? false : _ref$colors,
	      _ref$customInspect = _ref.customInspect,
	      customInspect = _ref$customInspect === void 0 ? true : _ref$customInspect,
	      _ref$showProxy = _ref.showProxy,
	      showProxy = _ref$showProxy === void 0 ? false : _ref$showProxy,
	      _ref$maxArrayLength = _ref.maxArrayLength,
	      maxArrayLength = _ref$maxArrayLength === void 0 ? Infinity : _ref$maxArrayLength,
	      _ref$breakLength = _ref.breakLength,
	      breakLength = _ref$breakLength === void 0 ? Infinity : _ref$breakLength,
	      _ref$seen = _ref.seen,
	      seen = _ref$seen === void 0 ? [] : _ref$seen,
	      _ref$truncate = _ref.truncate,
	      truncate = _ref$truncate === void 0 ? Infinity : _ref$truncate,
	      _ref$stylize = _ref.stylize,
	      stylize = _ref$stylize === void 0 ? String : _ref$stylize;

	  var options = {
	    showHidden: Boolean(showHidden),
	    depth: Number(depth),
	    colors: Boolean(colors),
	    customInspect: Boolean(customInspect),
	    showProxy: Boolean(showProxy),
	    maxArrayLength: Number(maxArrayLength),
	    breakLength: Number(breakLength),
	    truncate: Number(truncate),
	    seen: seen,
	    stylize: stylize
	  };

	  if (options.colors) {
	    options.stylize = colorise;
	  }

	  return options;
	}
	function truncate(string, length) {
	  var tail = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : truncator;
	  string = String(string);
	  var tailLength = tail.length;
	  var stringLength = string.length;

	  if (tailLength > length && stringLength > tailLength) {
	    return tail;
	  }

	  if (stringLength > length && stringLength > tailLength) {
	    return "".concat(string.slice(0, length - tailLength)).concat(tail);
	  }

	  return string;
	} // eslint-disable-next-line complexity

	function inspectList(list, options, inspectItem) {
	  var separator = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : ', ';
	  inspectItem = inspectItem || options.inspect;
	  var size = list.length;
	  if (size === 0) return '';
	  var originalLength = options.truncate;
	  var output = '';
	  var peek = '';
	  var truncated = '';

	  for (var i = 0; i < size; i += 1) {
	    var last = i + 1 === list.length;
	    var secondToLast = i + 2 === list.length;
	    truncated = "".concat(truncator, "(").concat(list.length - i, ")");
	    var value = list[i]; // If there is more than one remaining we need to account for a separator of `, `

	    options.truncate = originalLength - output.length - (last ? 0 : separator.length);
	    var string = peek || inspectItem(value, options) + (last ? '' : separator);
	    var nextLength = output.length + string.length;
	    var truncatedLength = nextLength + truncated.length; // If this is the last element, and adding it would
	    // take us over length, but adding the truncator wouldn't - then break now

	    if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
	      break;
	    } // If this isn't the last or second to last element to scan,
	    // but the string is already over length then break here


	    if (!last && !secondToLast && truncatedLength > originalLength) {
	      break;
	    } // Peek at the next string to determine if we should
	    // break early before adding this item to the output


	    peek = last ? '' : inspectItem(list[i + 1], options) + (secondToLast ? '' : separator); // If we have one element left, but this element and
	    // the next takes over length, the break early

	    if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
	      break;
	    }

	    output += string; // If the next element takes us to length -
	    // but there are more after that, then we should truncate now

	    if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
	      truncated = "".concat(truncator, "(").concat(list.length - i - 1, ")");
	      break;
	    }

	    truncated = '';
	  }

	  return "".concat(output).concat(truncated);
	}
	function inspectProperty(_ref2, options) {
	  var _ref3 = _slicedToArray(_ref2, 2),
	      key = _ref3[0],
	      value = _ref3[1];

	  options.truncate -= 2;

	  if (typeof key !== 'string' && typeof key !== 'number') {
	    key = "[".concat(options.inspect(key, options), "]");
	  }

	  options.truncate -= key.length;
	  value = options.inspect(value, options);
	  return "".concat(key, ": ").concat(value);
	}

	function inspectArray(array, options) {
	  // Object.keys will always output the Array indices first, so we can slice by
	  // `array.length` to get non-index properties
	  var nonIndexProperties = Object.keys(array).slice(array.length);
	  if (!array.length && !nonIndexProperties.length) return '[]';
	  options.truncate -= 4;
	  var listContents = inspectList(array, options);
	  options.truncate -= listContents.length;
	  var propertyContents = '';

	  if (nonIndexProperties.length) {
	    propertyContents = inspectList(nonIndexProperties.map(function (key) {
	      return [key, array[key]];
	    }), options, inspectProperty);
	  }

	  return "[ ".concat(listContents).concat(propertyContents ? ", ".concat(propertyContents) : '', " ]");
	}

	/* !
	 * Chai - getFuncName utility
	 * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
	 * MIT Licensed
	 */

	/**
	 * ### .getFuncName(constructorFn)
	 *
	 * Returns the name of a function.
	 * When a non-function instance is passed, returns `null`.
	 * This also includes a polyfill function if `aFunc.name` is not defined.
	 *
	 * @name getFuncName
	 * @param {Function} funct
	 * @namespace Utils
	 * @api public
	 */

	var toString = Function.prototype.toString;
	var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\s\(\/]+)/;
	function getFuncName(aFunc) {
	  if (typeof aFunc !== 'function') {
	    return null;
	  }

	  var name = '';
	  if (typeof Function.prototype.name === 'undefined' && typeof aFunc.name === 'undefined') {
	    // Here we run a polyfill if Function does not support the `name` property and if aFunc.name is not defined
	    var match = toString.call(aFunc).match(functionNameMatch);
	    if (match) {
	      name = match[1];
	    }
	  } else {
	    // If we've got a `name` property we just use it
	    name = aFunc.name;
	  }

	  return name;
	}

	var getFuncName_1 = getFuncName;

	var toStringTag = typeof Symbol !== 'undefined' && Symbol.toStringTag ? Symbol.toStringTag : false;

	var getArrayName = function getArrayName(array) {
	  // We need to special case Node.js' Buffers, which report to be Uint8Array
	  if (typeof Buffer === 'function' && array instanceof Buffer) {
	    return 'Buffer';
	  }

	  if (toStringTag && toStringTag in array) {
	    return array[toStringTag];
	  }

	  return getFuncName_1(array.constructor);
	};

	function inspectTypedArray(array, options) {
	  var name = getArrayName(array);
	  options.truncate -= name.length + 4; // Object.keys will always output the Array indices first, so we can slice by
	  // `array.length` to get non-index properties

	  var nonIndexProperties = Object.keys(array).slice(array.length);
	  if (!array.length && !nonIndexProperties.length) return "".concat(name, "[]"); // As we know TypedArrays only contain Unsigned Integers, we can skip inspecting each one and simply
	  // stylise the toString() value of them

	  var output = '';

	  for (var i = 0; i < array.length; i++) {
	    var string = "".concat(options.stylize(truncate(array[i], options.truncate), 'number')).concat(array[i] === array.length ? '' : ', ');
	    options.truncate -= string.length;

	    if (array[i] !== array.length && options.truncate <= 3) {
	      output += "".concat(truncator, "(").concat(array.length - array[i] + 1, ")");
	      break;
	    }

	    output += string;
	  }

	  var propertyContents = '';

	  if (nonIndexProperties.length) {
	    propertyContents = inspectList(nonIndexProperties.map(function (key) {
	      return [key, array[key]];
	    }), options, inspectProperty);
	  }

	  return "".concat(name, "[ ").concat(output).concat(propertyContents ? ", ".concat(propertyContents) : '', " ]");
	}

	function inspectDate(dateObject, options) {
	  // If we need to - truncate the time portion, but never the date
	  var split = dateObject.toJSON().split('T');
	  var date = split[0];
	  return options.stylize("".concat(date, "T").concat(truncate(split[1], options.truncate - date.length - 1)), 'date');
	}

	var toString$1 = Object.prototype.toString;

	var getFunctionName = function(fn) {
	  if (toString$1.call(fn) !== '[object Function]') return null
	  if (fn.name) return fn.name
	  var name = /^\s*function\s*([^\(]*)/im.exec(fn.toString())[1];
	  return name || 'anonymous'
	};

	function inspectFunction(func, options) {
	  var name = getFunctionName(func);

	  if (name === 'anonymous') {
	    return options.stylize('[Function]', 'special');
	  }

	  return options.stylize("[Function ".concat(truncate(name, options.truncate - 11), "]"), 'special');
	}

	function inspectMapEntry(_ref, options) {
	  var _ref2 = _slicedToArray(_ref, 2),
	      key = _ref2[0],
	      value = _ref2[1];

	  options.truncate -= 4;
	  key = options.inspect(key, options);
	  options.truncate -= key.length;
	  value = options.inspect(value, options);
	  return "".concat(key, " => ").concat(value);
	} // IE11 doesn't support `map.entries()`


	function mapToEntries(map) {
	  var entries = [];
	  map.forEach(function (value, key) {
	    entries.push([key, value]);
	  });
	  return entries;
	}

	function inspectMap(map, options) {
	  var size = map.size - 1;

	  if (size <= 0) {
	    return 'Map{}';
	  }

	  options.truncate -= 7;
	  return "Map{ ".concat(inspectList(mapToEntries(map), options, inspectMapEntry), " }");
	}

	var isNaN = Number.isNaN || function (i) {
	  return i !== i;
	}; // eslint-disable-line no-self-compare


	function inspectBigInt(number, options) { return number.toString() + 'n'; };

	function inspectNumber(number, options) {
	  if (isNaN(number)) {
	    return options.stylize('NaN', 'number');
	  }

	  if (number === Infinity) {
	    return options.stylize('Infinity', 'number');
	  }

	  if (number === -Infinity) {
	    return options.stylize('-Infinity', 'number');
	  }

	  if (number === 0) {
	    return options.stylize(1 / number === Infinity ? '+0' : '-0', 'number');
	  }

	  return options.stylize(truncate(number, options.truncate), 'number');
	}

	function inspectRegExp(value, options) {
	  var flags = value.toString().split('/')[2];
	  var sourceLength = options.truncate - (2 + flags.length);
	  var source = value.source;
	  return options.stylize("/".concat(truncate(source, sourceLength), "/").concat(flags), 'regexp');
	}

	function arrayFromSet(set) {
	  var values = [];
	  set.forEach(function (value) {
	    values.push(value);
	  });
	  return values;
	}

	function inspectSet(set, options) {
	  if (set.size === 0) return 'Set{}';
	  options.truncate -= 7;
	  return "Set{ ".concat(inspectList(arrayFromSet(set), options), " }");
	}

	var stringEscapeChars = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5" + "\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", 'g');
	var escapeCharacters = {
	  '\b': '\\b',
	  '\t': '\\t',
	  '\n': '\\n',
	  '\f': '\\f',
	  '\r': '\\r',
	  "'": "\\'",
	  '\\': '\\\\'
	};
	var hex = 16;
	var unicodeLength = 4;

	function escape(char) {
	  return escapeCharacters[char] || "\\u".concat("0000".concat(char.charCodeAt(0).toString(hex)).slice(-unicodeLength));
	}

	function inspectString(string, options) {
	  if (stringEscapeChars.test(string)) {
	    string = string.replace(stringEscapeChars, escape);
	  }

	  return options.stylize("'".concat(truncate(string, options.truncate - 2), "'"), 'string');
	}

	function inspectSymbol(value) {
	  if ('description' in Symbol.prototype) {
	    return "Symbol(".concat(value.description, ")");
	  }

	  return value.toString();
	}

	var getPromiseValue = function getPromiseValue() {
	  return 'Promise{…}';
	};

	try {
	  var _process$binding = process.binding('util'),
	      getPromiseDetails = _process$binding.getPromiseDetails,
	      kPending = _process$binding.kPending,
	      kRejected = _process$binding.kRejected;

	  getPromiseValue = function getPromiseValue(value, options) {
	    var _getPromiseDetails = getPromiseDetails(value),
	        _getPromiseDetails2 = _slicedToArray(_getPromiseDetails, 2),
	        state = _getPromiseDetails2[0],
	        innerValue = _getPromiseDetails2[1];

	    if (state === kPending) {
	      return 'Promise{<pending>}';
	    }

	    return "Promise".concat(state === kRejected ? '!' : '', "{").concat(options.inspect(innerValue, options), "}");
	  };
	} catch (notNode) {
	  /* ignore */
	}

	var inspectPromise = getPromiseValue;

	function inspectObject(object, options) {
	  var properties = Object.getOwnPropertyNames(object);
	  var symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];

	  if (properties.length === 0 && symbols.length === 0) {
	    return '{}';
	  }

	  options.truncate -= 4;
	  var propertyContents = inspectList(properties.map(function (key) {
	    return [key, object[key]];
	  }), options, inspectProperty);
	  var symbolContents = inspectList(symbols.map(function (key) {
	    return [key, object[key]];
	  }), options, inspectProperty);
	  var sep = '';

	  if (propertyContents && symbolContents) {
	    sep = ', ';
	  }

	  return "{ ".concat(propertyContents).concat(sep).concat(symbolContents, " }");
	}

	var toStringTag$1 = typeof Symbol !== 'undefined' && Symbol.toStringTag ? Symbol.toStringTag : false;
	function inspectClass(value, options) {
	  var name = '';

	  if (toStringTag$1 && toStringTag$1 in value) {
	    name = value[toStringTag$1];
	  }

	  name = name || getFuncName_1(value.constructor); // Babel transforms anonymous classes to the name `_class`

	  if (!name || name === '_class') {
	    name = '<Anonymous Class>';
	  }

	  options.truncate -= name.length;
	  return "".concat(name).concat(inspectObject(value, options));
	}

	function inspectArguments(args, options) {
	  if (args.length === 0) return 'Arguments[]';
	  options.truncate -= 13;
	  return "Arguments[ ".concat(inspectList(args, options), " ]");
	}

	var errorKeys = ['stack', 'line', 'column', 'name', 'message', 'fileName', 'lineNumber', 'columnNumber', 'number', 'description'];
	function inspectObject$1(error, options) {
	  var properties = Object.getOwnPropertyNames(error).filter(function (key) {
	    return errorKeys.indexOf(key) === -1;
	  });
	  var name = error.name;
	  options.truncate -= name.length;
	  var message = '';

	  if (typeof error.message === 'string') {
	    message = truncate(error.message, options.truncate);
	  } else {
	    properties.unshift('message');
	  }

	  message = message ? ": ".concat(message) : '';
	  options.truncate -= message.length + 5;
	  var propertyContents = inspectList(properties.map(function (key) {
	    return [key, error[key]];
	  }), options, inspectProperty);
	  return "".concat(name).concat(message).concat(propertyContents ? " { ".concat(propertyContents, " }") : '');
	}

	function inspectAttribute(_ref, options) {
	  var _ref2 = _slicedToArray(_ref, 2),
	      key = _ref2[0],
	      value = _ref2[1];

	  options.truncate -= 3;

	  if (!value) {
	    return "".concat(options.stylize(key, 'yellow'));
	  }

	  return "".concat(options.stylize(key, 'yellow'), "=").concat(options.stylize("\"".concat(value, "\""), 'string'));
	}
	function inspectHTMLCollection(collection, options) {
	  // eslint-disable-next-line no-use-before-define
	  return inspectList(collection, options, inspectHTML, '\n');
	}
	function inspectHTML(element, options) {
	  var properties = element.getAttributeNames();
	  var name = element.tagName.toLowerCase();
	  var head = options.stylize("<".concat(name), 'special');
	  var headClose = options.stylize(">", 'special');
	  var tail = options.stylize("</".concat(name, ">"), 'special');
	  options.truncate -= name.length * 2 + 5;
	  var propertyContents = '';

	  if (properties.length > 0) {
	    propertyContents += ' ';
	    propertyContents += inspectList(properties.map(function (key) {
	      return [key, element.getAttribute(key)];
	    }), options, inspectAttribute, ' ');
	  }

	  options.truncate -= propertyContents.length;
	  var truncate = options.truncate;
	  var children = inspectHTMLCollection(element.children, options);

	  if (children && children.length > truncate) {
	    children = "".concat(truncator, "(").concat(element.children.length, ")");
	  }

	  return "".concat(head).concat(propertyContents).concat(headClose).concat(children).concat(tail);
	}

	/* !
	 * loupe
	 * Copyright(c) 2013 Jake Luer <jake@alogicalparadox.com>
	 * MIT Licensed
	 */
	var symbolsSupported = typeof Symbol === 'function' && typeof Symbol.for === 'function';
	var chaiInspect = symbolsSupported ? Symbol.for('chai/inspect') : '@@chai/inspect';
	var nodeInspect = false;

	try {
	  // eslint-disable-next-line global-require
	  nodeInspect = require('util').inspect.custom;
	} catch (noNodeInspect) {
	  nodeInspect = false;
	}

	var constructorMap = new WeakMap();
	var stringTagMap = {};
	var baseTypesMap = {
	  undefined: function undefined$1(value, options) {
	    return options.stylize('undefined', 'undefined');
	  },
	  null: function _null(value, options) {
	    return options.stylize(null, 'null');
	  },
	  boolean: function boolean(value, options) {
	    return options.stylize(value, 'boolean');
	  },
	  Boolean: function Boolean(value, options) {
	    return options.stylize(value, 'boolean');
	  },
	  number: inspectNumber,
	  Number: inspectNumber,
	  BigInt: inspectBigInt,
	  bigint: inspectBigInt,
	  string: inspectString,
	  String: inspectString,
	  function: inspectFunction,
	  Function: inspectFunction,
	  symbol: inspectSymbol,
	  // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
	  Symbol: inspectSymbol,
	  Array: inspectArray,
	  Date: inspectDate,
	  Map: inspectMap,
	  Set: inspectSet,
	  RegExp: inspectRegExp,
	  Promise: inspectPromise,
	  // WeakSet, WeakMap are totally opaque to us
	  WeakSet: function WeakSet(value, options) {
	    return options.stylize('WeakSet{…}', 'special');
	  },
	  WeakMap: function WeakMap(value, options) {
	    return options.stylize('WeakMap{…}', 'special');
	  },
	  Arguments: inspectArguments,
	  Int8Array: inspectTypedArray,
	  Uint8Array: inspectTypedArray,
	  Uint8ClampedArray: inspectTypedArray,
	  Int16Array: inspectTypedArray,
	  Uint16Array: inspectTypedArray,
	  Int32Array: inspectTypedArray,
	  Uint32Array: inspectTypedArray,
	  Float32Array: inspectTypedArray,
	  Float64Array: inspectTypedArray,
	  Generator: function Generator() {
	    return '';
	  },
	  DataView: function DataView() {
	    return '';
	  },
	  ArrayBuffer: function ArrayBuffer() {
	    return '';
	  },
	  Error: inspectObject$1,
	  HTMLCollection: inspectHTMLCollection,
	  NodeList: inspectHTMLCollection
	}; // eslint-disable-next-line complexity

	var inspectCustom = function inspectCustom(value, options, type) {
	  if (chaiInspect in value && typeof value[chaiInspect] === 'function') {
	    return value[chaiInspect](options);
	  }

	  if (nodeInspect && nodeInspect in value && typeof value[nodeInspect] === 'function') {
	    return value[nodeInspect](options.depth, options);
	  }

	  if ('inspect' in value && typeof value.inspect === 'function') {
	    return value.inspect(options.depth, options);
	  }

	  if ('constructor' in value && constructorMap.has(value.constructor)) {
	    return constructorMap.get(value.constructor)(value, options);
	  }

	  if (stringTagMap[type]) {
	    return stringTagMap[type](value, options);
	  }

	  return '';
	}; // eslint-disable-next-line complexity


	function inspect(value, options) {
	  options = normaliseOptions(options);
	  options.inspect = inspect;
	  var _options = options,
	      customInspect = _options.customInspect;
	  var type = typeDetect(value); // If it is a base value that we already support, then use Loupe's inspector

	  if (baseTypesMap[type]) {
	    return baseTypesMap[type](value, options);
	  }

	  var proto = value ? Object.getPrototypeOf(value) : false; // If it's a plain Object then use Loupe's inspector

	  if (proto === Object.prototype || proto === null) {
	    return inspectObject(value, options);
	  } // Specifically account for HTMLElements
	  // eslint-disable-next-line no-undef


	  if (value && typeof HTMLElement === 'function' && value instanceof HTMLElement) {
	    return inspectHTML(value, options);
	  } // If `options.customInspect` is set to true then try to use the custom inspector


	  if (customInspect && value) {
	    var output = inspectCustom(value, options, type);
	    if (output) return output;
	  } // If it is a class, inspect it like an object but add the constructor name


	  if ('constructor' in value && value.constructor !== Object) {
	    return inspectClass(value, options);
	  } // We have run out of options! Just stringify the value


	  return options.stylize(String(value), type);
	}
	function registerConstructor(constructor, inspector) {
	  if (constructorMap.has(constructor)) {
	    return false;
	  }

	  constructorMap.add(constructor, inspector);
	  return true;
	}
	function registerStringTag(stringTag, inspector) {
	  if (stringTag in stringTagMap) {
	    return false;
	  }

	  stringTagMap[stringTag] = inspector;
	  return true;
	}
	var custom = chaiInspect;

	exports.custom = custom;
	exports.default = inspect;
	exports.inspect = inspect;
	exports.registerConstructor = registerConstructor;
	exports.registerStringTag = registerStringTag;

	Object.defineProperty(exports, '__esModule', { value: true });

})));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"_process":21,"buffer":17,"util":24}],13:[function(require,module,exports){
(function() {
  'use strict';
  //===========================================================================================================
  // OBJECT PROPERTY CATALOGUING
  //-----------------------------------------------------------------------------------------------------------
  this.keys_of = function(...P) {
    return this.values_of(this.walk_keys_of(...P));
  };

  this.all_keys_of = function(...P) {
    return this.values_of(this.walk_all_keys_of(...P));
  };

  this.all_own_keys_of = function(x) {
    if (x != null) {
      return Object.getOwnPropertyNames(x);
    } else {
      return [];
    }
  };

  this.walk_all_own_keys_of = function*(x) {
    var i, k, len, ref, results;
    ref = this.all_own_keys_of(x);
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      k = ref[i];
      results.push((yield k));
    }
    return results;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.walk_keys_of = function*(x, settings) {
    var defaults, k, results;
    defaults = {
      skip_undefined: true
    };
    settings = {...defaults, ...settings};
    results = [];
    for (k in x) {
      if ((x[k] === void 0) && settings.skip_undefined) {
        /* TAINT should use property descriptors to avoid possible side effects */
        continue;
      }
      results.push((yield k));
    }
    return results;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.walk_all_keys_of = function(x, settings) {
    var defaults;
    defaults = {
      skip_object: true,
      skip_undefined: true
    };
    settings = {...defaults, ...settings};
    return this._walk_all_keys_of(x, new Set(), settings);
  };

  //-----------------------------------------------------------------------------------------------------------
  this._walk_all_keys_of = function*(x, seen, settings) {
    /* TAINT should use property descriptors to avoid possible side effects */
    /* TAINT trying to access `arguments` causes error */
    var error, k, proto, ref, value;
    if ((!settings.skip_object) && x === Object.prototype) {
      return;
    }
    ref = this.walk_all_own_keys_of(x);
    //.........................................................................................................
    for (k of ref) {
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      try {
        value = x[k];
      } catch (error1) {
        error = error1;
        continue;
      }
      if ((value === void 0) && settings.skip_undefined) {
        continue;
      }
      if (settings.symbol != null) {
        if (value == null) {
          continue;
        }
        if (!value[settings.symbol]) {
          continue;
        }
      }
      yield k;
    }
    //.........................................................................................................
    if ((proto = Object.getPrototypeOf(x)) != null) {
      return (yield* this._walk_all_keys_of(proto, seen, settings));
    }
  };

  //-----------------------------------------------------------------------------------------------------------
  /* Turn iterators into lists, copy lists: */
  this.values_of = function(x) {
    return [...x];
  };

  //-----------------------------------------------------------------------------------------------------------
  this.has_keys = function(x, ...P) {
    var i, key, len, ref;
    if (x == null) {
      /* Observe that `has_keys()` always considers `undefined` as 'not set' */
      return false;
    }
/* TAINT or throw error */    ref = P.flat(2e308);
    for (i = 0, len = ref.length; i < len; i++) {
      key = ref[i];
      if (x[key] === void 0) {
        /* TAINT should use property descriptors to avoid possible side effects */
        return false;
      }
    }
    return true;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.has_key = function(x, key) {
    return this.has_keys(x, key);
  };

  //-----------------------------------------------------------------------------------------------------------
  this.has_only_keys = function(x, ...P) {
    var keys, probes;
    probes = (P.flat(2e308)).sort();
    keys = (this.values_of(this.keys_of(x))).sort();
    return probes.length = keys.length && probes.every(function(x, idx) {
      return x === keys[idx];
    });
  };

}).call(this);


},{}],14:[function(require,module,exports){
(function() {
  'use strict';
  var Multimix, module_keywords,
    indexOf = [].indexOf;

  //===========================================================================================================
  // MODULE METACLASS provides static methods `@extend()`, `@include()`
  //-----------------------------------------------------------------------------------------------------------
  /* The little dance around the module_keywords variable is to ensure we have callback support when mixins
  extend a class. See https://arcturo.github.io/library/coffeescript/03_classes.html */
  //-----------------------------------------------------------------------------------------------------------
  module_keywords = ['extended', 'included'];

  Multimix = (function() {
    //===========================================================================================================
    class Multimix {
      //---------------------------------------------------------------------------------------------------------
      static extend(object, settings = null) {
        var key, ref, value;
        settings = {...{
            overwrite: true
          }, ...(settings != null ? settings : null)};
        for (key in object) {
          value = object[key];
          if (!(indexOf.call(module_keywords, key) < 0)) {
            continue;
          }
          if ((!settings.overwrite) && ((this.prototype[key] != null) || (this[key] != null))) {
            throw new Error(`^multimix/include@5684 overwrite set to false but name already set: ${JSON.stringify(key)}`);
          }
          this[key] = value;
        }
        if ((ref = object.extended) != null) {
          ref.apply(this);
        }
        return this;
      }

      //---------------------------------------------------------------------------------------------------------
      static include(object, settings = null) {
        var key, ref, value;
        settings = {...{
            overwrite: true
          }, ...(settings != null ? settings : null)};
        for (key in object) {
          value = object[key];
          if (!(indexOf.call(module_keywords, key) < 0)) {
            continue;
          }
          if ((!settings.overwrite) && ((this.prototype[key] != null) || (this[key] != null))) {
            throw new Error(`^multimix/include@5683 overwrite set to false but name already set: ${JSON.stringify(key)}`);
          }
          // Assign properties to the prototype
          this.prototype[key] = value;
        }
        if ((ref = object.included) != null) {
          ref.apply(this);
        }
        return this;
      }

      //---------------------------------------------------------------------------------------------------------
      export(target = null) {
        /* Return an object with methods, bound to the current instance. */
        var R, k, ref, ref1, v;
        R = target != null ? target : {};
        ref = (require('./cataloguing')).walk_all_keys_of(this);
        for (k of ref) {
          v = this[k];
          if ((v != null ? v.bind : void 0) == null) {
            R[k] = v;
          } else if ((ref1 = v[Multimix.isa_keymethod_proxy]) != null ? ref1 : false) {
            R[k] = Multimix.get_keymethod_proxy(this, v);
          } else {
            R[k] = v.bind(this);
          }
        }
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      get_my_prototype() {
        return Object.getPrototypeOf(Object.getPrototypeOf(this));
      }

      //---------------------------------------------------------------------------------------------------------
      new(...P) {
        return new this.constructor(...P);
      }

      //=========================================================================================================
      // KEYMETHOD FACTORY
      //---------------------------------------------------------------------------------------------------------
      static get_keymethod_proxy(bind_target, f) {
        var R;
        R = new Proxy(f.bind(bind_target), {
          get: function(target, key) {
            if (key === 'bind') { // ... other properties ...
              return target[key];
            }
            if ((typeof key) === 'symbol') {
              return target[key];
            }
            return function(...xP) {
              return target(key, ...xP);
            };
          }
        });
        R[Multimix.isa_keymethod_proxy] = true;
        return R;
      }

    };

    //=========================================================================================================
    // @js_type_of = ( x ) -> return ( ( Object::toString.call x ).slice 8, -1 ).toLowerCase()
    Multimix.isa_keymethod_proxy = Symbol('proxy');

    return Multimix;

  }).call(this);

  //###########################################################################################################
  module.exports = Multimix;

}).call(this);


},{"./cataloguing":13}],15:[function(require,module,exports){

},{}],16:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],17:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)
},{"base64-js":16,"buffer":17,"ieee754":18}],18:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],19:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],20:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":21}],21:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],22:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],23:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],24:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":23,"_process":21,"inherits":22}]},{},[1]);
