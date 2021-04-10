(function() {
  'use strict';
  var debug, declare, freeze, isa, misfit, push_circular, ref, ref1, rpr, set, types, validate;

  //###########################################################################################################
  types = new (require('intertype')).Intertype();

  ({validate, isa, declare} = types.export());

  freeze = Object.freeze;

  misfit = Symbol('misfit');

  debug = (ref = globalThis.debug) != null ? ref : console.debug;

  rpr = (ref1 = globalThis.rpr) != null ? ref1 : JSON.stringify;

  // console.log '^e23984^', globalThis.rpr
  // console.log '^e23984^', rpr; process.exit 2

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

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  this.Intermatic = (function() {
    class Intermatic {
      //---------------------------------------------------------------------------------------------------------
      constructor(fsmd) {
        var ref2;
        // validate.fsmd fsmd
        // @_types               = types
        this._tmp = {};
        this._tmp.fsmd = {...fsmd};
        this._tmp.known_names = new Set();
        this.name = (ref2 = this._tmp.fsmd.name) != null ? ref2 : 'FSM';
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
          var i, len, ref3, results, stage, stages;
          ref3 = [this._trigger_stages, this._state_stages];
          results = [];
          for (i = 0, len = ref3.length; i < len; i++) {
            stages = ref3[i];
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
        this._path = null;
        /* TAINT use read-only properties: */
        this._omit_root_name = false;
        this._path_separator = '/';
        this.up = null;
        (() => {          //.......................................................................................................
          var k;
/* TAINT should definitely simplify logic, maybe use FSM as protoype for sub-FSM? */
          for (k in this) {
            this._reserved_keys.add(k);
          }
          return null;
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
        this._compile_omit_root_name();
        this._compile_path_separator();
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
        var fsmd_moves, i, len, lstates, monotrajectory, ref2, trajectory, verb, verbs;
        this._tmp.known_names.add('moves');
        // starred       = {}
        lstates = new Set(['void']);
        fsmd_moves = (ref2 = this._tmp.fsmd.moves) != null ? ref2 : {};
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
        var base, dest, dpar, i, ref2, tidx;
        for (tidx = i = 0, ref2 = trajectory.length - 1; (0 <= ref2 ? i < ref2 : i > ref2); tidx = 0 <= ref2 ? ++i : --i) {
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
        var dests_by_deps, ref2, verb;
        ref2 = this.moves;
        for (verb in ref2) {
          dests_by_deps = ref2[verb];
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
        var actions, i, j, len, len1, lstate, ref2, ref3, source, stage, target, verb;
        ref2 = this._trigger_stages;
        //.......................................................................................................
        for (i = 0, len = ref2.length; i < len; i++) {
          stage = ref2[i];
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
        ref3 = this._state_stages;
        //.......................................................................................................
        for (j = 0, len1 = ref3.length; j < len1; j++) {
          stage = ref3[j];
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
      _call_actions(target, stage, verb_or_lstate, ...P) {
        var i, len, ref2, transitioner, transitioners;
        if (target == null) {
          return null;
        }
        if ((transitioners = (ref2 = target[stage]) != null ? ref2[verb_or_lstate] : void 0) == null) {
          return null;
        }
        target._stage = stage;
        for (i = 0, len = transitioners.length; i < len; i++) {
          transitioner = transitioners[i];
          transitioner.apply(target, P);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_trigger(verb, dests_by_deps = null) {
        /* TAINT too much logic to be done at in run time, try to precompile more */
        var transitioner;
        return transitioner = (...P) => {
          var changed, dest, dpar, i, len, ref2, ref3, ref4, subfsm_name;
          /* TAINT use single transitioner method for all triggers? */
          this._nxt_verb = verb;
          /* TAINT consider to do this inside a property setter, as for `@lstate`: */
          this._prv_verbs = push_circular(this._prv_verbs, verb, this.history_length);
          this._nxt_dpar = dpar = this.lstate;
          //-------------------------------------------------------------------------------------------------
          if (dests_by_deps != null) {
            dest = (ref2 = (ref3 = dests_by_deps[dpar]) != null ? ref3 : dests_by_deps.any) != null ? ref2 : null;
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
            ref4 = this.fsm_names;
            for (i = 0, len = ref4.length; i < len; i++) {
              subfsm_name = ref4[i];
              this[subfsm_name].tryto(verb, ...P);
            }
          }
          while (true) {
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            //.....................................................................................................
            this._call_actions(this, 'before', 'any', ...P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions(this, 'before', 'change', ...P);
            }
            if (this._cancelled) {
              break;
            }
            this._call_actions(this, 'before', verb, ...P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
              this._call_actions(this, 'leaving', 'any', ...P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions(this, 'leaving', dpar, ...P);
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
              this._call_actions(this, 'keeping', 'any', ...P);
            }
            if (this._cancelled) {
              break;
            }
            if (!changed) {
              this._call_actions(this, 'keeping', dpar, ...P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
              this._call_actions(this, 'entering', 'any', ...P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions(this, 'entering', dest, ...P);
            }
            if (this._cancelled) {
              break;
            }
            // . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
            this._call_actions(this, 'after', 'any', ...P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions(this, 'after', 'change', ...P);
            }
            if (this._cancelled) {
              break;
            }
            this._call_actions(this, 'after', verb, ...P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions(this.root_fsm, 'after', 'EXP_any_change', this, ...P);
            }
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
        var dest, goto, i, len, ref2, transitioner;
        this._tmp.known_names.add('goto');
        if ((goto = this._tmp.fsmd.goto) != null) {
          validate.goto_target(goto);
          transitioner = this._get_trigger('goto', null);
          goto = (dest, ...P) => {
            return transitioner(dest, ...P);
          };
          ref2 = this.lstates;
          for (i = 0, len = ref2.length; i < len; i++) {
            dest = ref2[i];
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
        var fsm_names, ref2, ref3, sub_fsmd, subfsm_name;
        fsm_names = [];
        ref3 = (ref2 = this._tmp.fsmd) != null ? ref2 : {};
        for (subfsm_name in ref3) {
          sub_fsmd = ref3[subfsm_name];
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

      //---------------------------------------------------------------------------------------------------------
      _compile_omit_root_name() {
        var omit_root_name;
        if ((omit_root_name = this._tmp.fsmd.omit_root_name) == null) {
          return null;
        }
        if (!this.is_root_fsm) {
          throw new Error(`^intermatic@654^ can only set 'omit_root_name' in root FSM (offending FSM: ${this.path})`);
        }
        this._omit_root_name = omit_root_name;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_path_separator() {
        var path_separator;
        if ((path_separator = this._tmp.fsmd.path_separator) == null) {
          return null;
        }
        if (!this.is_root_fsm) {
          throw new Error(`^intermatic@655^ can only set 'path_separator' in root FSM (offending FSM: ${this.path})`);
        }
        this._path_separator = path_separator;
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _copy_other_attributes() {
        var pname, propd, ref2;
        ref2 = Object.getOwnPropertyDescriptors(this._tmp.fsmd);
        for (pname in ref2) {
          propd = ref2[pname];
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

      //---------------------------------------------------------------------------------------------------------
      * _walk_fsms(transitive = false) {
        var fsm, fsm_name, i, len, ref2;
        ref2 = this.fsm_names;
        for (i = 0, len = ref2.length; i < len; i++) {
          fsm_name = ref2[i];
          fsm = this[fsm_name];
          yield fsm;
          if (transitive) {
            yield* fsm._walk_fsms(transitive);
          }
        }
        return null;
      }

    };

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
          var R, i, len, ref2, subfsm_name, x;
          R = Object.assign({}, this.move);
          if ((x = this.path) != null) {
            R.path = x;
          }
          if ((x = this.data) != null) {
            R.data = freeze({...x});
          }
          ref2 = this.fsm_names;
          for (i = 0, len = ref2.length; i < len; i++) {
            subfsm_name = ref2[i];
            R[subfsm_name] = this[subfsm_name].cstate;
          }
          return freeze(R);
        }
      },
      //-------------------------------------------------------------------------------------------------------
      EXP_dstate: {
        enumerable: true,
        get: function() {
          var R, i, len, ref2, sub_fsm, subfsm_name, target;
          target = {
            lstate: this.lstate
          };
          R = {
            [this.name]: target
          };
          if (this.data != null) {
            target.data = this.data;
          }
          ref2 = this.fsm_names;
          for (i = 0, len = ref2.length; i < len; i++) {
            subfsm_name = ref2[i];
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
          return [...this._walk_fsms()];
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
      omit_root_name: {
        get: function() {
          var ref2;
          return ((ref2 = this.root_fsm) != null ? ref2 : this)._omit_root_name;
        }
      },
      path_separator: {
        get: function() {
          var ref2;
          return ((ref2 = this.root_fsm) != null ? ref2 : this)._path_separator;
        }
      },
      breadcrumbs: {
        get: function() {
          if (this.is_root_fsm) {
            return this._breadcrumbs = freeze(this.omit_root_name ? [] : [this.name]);
          }
          return this._breadcrumbs = freeze([...this.up.breadcrumbs, this.name]);
        }
      },
      path: {
        get: function() {
          return this._path = this.is_root_fsm ? this.name : this.breadcrumbs.join(this.path_separator);
        }
      },
      //-------------------------------------------------------------------------------------------------------
      is_root_fsm: {
        get: function() {
          return this.up == null;
        }
      },
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
          var R, dest, dpar, i, idx, len, ref2, verb;
          R = [];
          ref2 = this._prv_verbs;
          for (idx = i = 0, len = ref2.length; i < len; idx = ++i) {
            verb = ref2[idx];
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

}).call(this);

//# sourceMappingURL=main.js.map