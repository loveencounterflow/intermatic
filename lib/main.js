(function() {
  'use strict';
  var Intermatic, debug, declare, freeze, isa, push_circular, rpr, set, types, validate;

  //###########################################################################################################
  types = new (require('intertype')).Intertype();

  ({validate, isa, declare} = types.export());

  freeze = Object.freeze;

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
        this.up = null;
        this._path = null;
        this._compile_fail();
        // @_compile_cyclers()
        this._compile_moves();
        this._compile_triggers();
        this._compile_actions();
        // @_compile_handlers()
        this._compile_goto();
        // @_compile_can()
        // @_compile_tryto()
        this._compile_subfsms();
        // @_compile_data()
        // @_compile_cascades()
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
              this._call_actions('leaving', dpar, P);
            }
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this.lstate = dest;
            }
            if (!changed) {
              this._call_actions('keeping', dpar, P);
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
            this._call_actions('after', verb, P);
            if (this._cancelled) {
              break;
            }
            if (changed) {
              this._call_actions('after', 'change', P);
            }
            if (this._cancelled) {
              break;
            }
            this._call_actions('after', 'any', P);
            if (this._cancelled) {
              break;
            }
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

      // #---------------------------------------------------------------------------------------------------------
      // _compile_handlers: ->
      //   ### TAINT add handlers for trigger, change ###
      //   ### TAINT check names against reserved ###
      //   try
      //     for category in [ 'before', 'entering', 'keeping', 'leaving', 'after', ]
      //       @_tmp.known_names.add category
      //       for name, handler of @_tmp.fsmd[ category ] ? {}
      //         @[ category ][ name ] = handler.bind @
      //   catch error
      //     error.message += " — Error occurred during @_compile_handlers with #{rpr { category, name, handler, }}"
      //     throw error
      //   return null

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

      // #---------------------------------------------------------------------------------------------------------
      // _compile_can: ->
      //   @_tmp.known_names.add 'can'
      //   can = ( verb ) =>
      //     unless ( trigger = @triggers[ verb ] )?
      //       throw new Error "^intermatic/can@822^ unknown trigger #{rpr verb}"
      //     return trigger[ @lstate ]?
      //   for verb of @triggers
      //     do ( verb ) =>
      //       can[ verb ] = ( P... ) => can verb, P...
      //   set @, 'can', can
      //   return null

        // #---------------------------------------------------------------------------------------------------------
      // _compile_tryto: ->
      //   @_tmp.known_names.add 'tryto'
      //   tryto = ( verb, P... ) =>
      //     return false unless @can verb
      //     ### TAINT we will possibly want to return some kind of result from trigger ###
      //     @[ verb ] P...
      //     return true
      //   for verb of @triggers
      //     do ( verb ) =>
      //       tryto[ verb ] = ( P... ) => tryto verb, P...
      //   set @, 'tryto', tryto
      //   return null

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
            throw new Error(`^intermatic/_compile_subfsms@506^ name mismatch, got ${rpr(sub_fname)}, ${rpr(sub_fsmd.name)}`);
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

      // #---------------------------------------------------------------------------------------------------------
      // _compile_data: ->
      //   @_tmp.known_names.add 'data'
      //   return null unless ( data = @_tmp.fsmd.data )?
      //   @data = {}
      //   for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd.data
      //     Object.defineProperty @data, pname, propd
      //   return null

        // #---------------------------------------------------------------------------------------------------------
      // _compile_cascades: ->
      //   @_tmp.known_names.add 'cascades'
      //   return null unless ( cascades = @_tmp.fsmd.cascades )?
      //   @cascades = new Set cascades
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
          validate.lstate(lstate);
          this._prv_lstates = push_circular(this._prv_lstates, lstate, this.history_length + 1);
          return this._lstate = lstate;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      cstate: {
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
          if ((x = this.changed) != null) {
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

//# sourceMappingURL=main.js.map