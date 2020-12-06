(function() {
  'use strict';
  var Intermatic, debug, freeze, push_circular, rpr, set;

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
        this._tmp = {};
        this._tmp.fsmd = {...fsmd};
        this._tmp.known_names = new Set();
        this.moves = {};
        this.cascades = null;
        this.lstates = null;
        this.fsm_names = [];
        this.has_subfsms = false;
        this._lstate = 'void';
        this.trigger_actions = freeze(['before', 'after']);
        this.state_actions = freeze(['enter', 'leave', 'stay']);
        this.data = null;
        this.history_length = 1;
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
        this._compile_transitioners();
        // @_compile_handlers()
        // @_compile_goto()
        // @_compile_can()
        // @_compile_tryto()
        // @_compile_subfsms()
        // @_compile_data()
        // @_compile_cascades()
        // @_copy_other_attributes()
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
        /* TAINT validate.list_of.list triplet */
        /* TAINT validate.verb verb */
        /* TAINT validate that free of collision */
        /* TAINT validate.nonempty_text moves.start */
        /* TAINT validate.nonempty_list verbs */
        /* TAINT validate.nonempty_list moves[ verbs[ 0 ] ][ 0 ] */
        var base, dest, dpar, first_lstate, i, lstates, moves, ref, ref1, ref2, starred, tidx, trajectory, verb, verbs;
        starred = {};
        lstates = new Set(['void']);
        moves = this._tmp.fsmd.moves = {...((ref = this._tmp.fsmd.moves) != null ? ref : {})};
        verbs = (function() {
          var results;
          results = [];
          for (verb in moves) {
            results.push(verb);
          }
          return results;
        })();
        //.......................................................................................................
        if (moves.start == null) {
          first_lstate = (ref1 = moves[verbs[0]][0]) != null ? ref1 : 'void';
          moves.start = ['void', first_lstate];
        }
//.......................................................................................................
        for (verb in moves) {
          trajectory = moves[verb];
          //.....................................................................................................
          /* If the verb is `start`, then value may be just the name of the start verb instead of a list */
          /* TAINT validate.nonempty_text trajectory */
          if ((verb === 'start') && (typeof trajectory === 'string')) {
            trajectory = ['void', trajectory];
          }
//.....................................................................................................
          for (tidx = i = 0, ref2 = trajectory.length - 1; (0 <= ref2 ? i < ref2 : i > ref2); tidx = 0 <= ref2 ? ++i : --i) {
            dpar = trajectory[tidx];
            dest = trajectory[tidx + 1];
            //...................................................................................................
            lstates.add(dpar);
            lstates.add(dest);
            set(((base = this.moves)[verb] != null ? base[verb] : base[verb] = {}), dpar, dest);
          }
        }
        //.......................................................................................................
        this.lstates = freeze([...lstates]);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _compile_transitioners() {
        var dests_by_deps, ref, verb;
        this._tmp.known_names.add('moves');
        ref = this.moves;
        for (verb in ref) {
          dests_by_deps = ref[verb];
          ((verb, dests_by_deps) => {
            var handlers, lifecycle, ref1, ref2, transitioner;
            transitioner = this._get_transitioner(verb, dests_by_deps);
            ref2 = (ref1 = this._tmp.fsmd[verb]) != null ? ref1 : {};
            /* Attach lifecycle handlers to transitioner such that `fsmd[verb].before` becomes
                   `fsm[verb].before` and so on: */
            for (lifecycle in ref2) {
              handlers = ref2[lifecycle];
              if (!(Array.isArray(handlers))) {
                handlers = [handlers];
              }
              set(transitioner, lifecycle, handlers);
            }
            set(this, verb, transitioner);
            return this._tmp.known_names.add(verb);
          })(verb, dests_by_deps);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _get_transitioner(verb, dests_by_deps = null) {
        /* TAINT add extra arguments P */
        /* TAINT too much logic to be done at in run time, try to precompile more */
        var transitioner;
        return transitioner = (...P) => {
          var call_handlers, changed, dest, dpar, i, len, ref, ref1, ref2, ref3, subfsm_name;
          /* TAINT use single transitioner method for all triggers? */
          this._nxt_verb = verb;
          /* TAINT consider to do this inside a property setter, as for `@lstate`: */
          this._prv_verbs = push_circular(this._prv_verbs, verb, this.history_length);
          this._nxt_dpar = dpar = this.lstate;
          // id              = @_new_tid()
          //-------------------------------------------------------------------------------------------------
          // if not dests_by_deps?
          //   debug '^374873^', verb, P
          if (dests_by_deps != null) {
            dest = (ref = dests_by_deps[dpar]) != null ? ref : null;
          } else {
            [dest, ...P] = P;
          }
          if (dest == null) {
            return this.fail(...P);
          }
          this._nxt_dest = dest;
          //.....................................................................................................
          changed = dest !== dpar;
          //.....................................................................................................
          if (this.cascades && this.cascades.has(verb)) {
            ref1 = this.fsm_names;
            for (i = 0, len = ref1.length; i < len; i++) {
              subfsm_name = ref1[i];
              this[subfsm_name].tryto(verb, ...P);
            }
          }
          //.....................................................................................................
          // for aname, actions of @before
          //   continue unless ( aname is 'any' ) or ( aname is XXXX )
          //   for action in actions
          //     XXXXX
          debug('^333344^', {verb, dpar, dest, changed});
          debug('^333344^', this[verb]);
          debug('^333344^', (ref2 = this[verb]) != null ? ref2.before : void 0);
          // @before.any?              P...
          // @before.change?           P... if changed
          call_handlers = (handlers, ...P) => {
            var handler, j, len1;
            if (handlers == null) {
              return null;
            }
            for (j = 0, len1 = handlers.length; j < len1; j++) {
              handler = handlers[j];
              handler.apply(this, P);
            }
            return null;
          };
          call_handlers((ref3 = this[verb]) != null ? ref3.before : void 0, ...P);
          // #.....................................................................................................
          // @leave.any?               P... if changed
          // @leave[ dpar ]?           P... if changed
          // #.....................................................................................................
          // @lstate = dest if changed
          // #.....................................................................................................
          // @stay.any?                P... if not changed
          // @stay[ dest ]?            P... if not changed
          // @enter.any?               P... if changed
          // @enter[ dest ]?           P... if changed
          // #.....................................................................................................
          // @after[ verb ]?           P...
          // @after.change?            P... if changed
          // @after.any?               P...
          //.....................................................................................................
          /* NOTE At this point, the transition has finished, so we reset the `@_nxt_*` attributes: */
          this._nxt_verb = null;
          this._nxt_dest = null;
          this._nxt_dpar = null;
          //.....................................................................................................
          return null;
        };
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
            throw new Error(`^intermatic/set/lstate@501^ lstate name must be text, got ${rpr(lstate)}`);
          }
          this._prv_lstates = push_circular(this._prv_lstates, lstate, this.history_length + 1);
          return this._lstate = lstate;
        }
      },
      //-------------------------------------------------------------------------------------------------------
      cstate: {
        get: function() {
          var R, i, len, ref, subfsm_name, x;
          R = {};
          R.path = this.path;
          R.lstate = this.lstate;
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
          if ((this.dpar != null) && (this.dest == null)) {
            R.failed = true;
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
      EXP_cstate: {
        get: function() {
          var R, i, len, ref, subfsm_name, x;
          R = {};
          R.lstate = this.lstate;
          if ((x = this.data) != null) {
            R.data = freeze({...x});
          }
          ref = this.fsm_names;
          for (i = 0, len = ref.length; i < len; i++) {
            subfsm_name = ref[i];
            R[subfsm_name] = this[subfsm_name].EXP_cstate;
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
      verb: {
        get: function() {
          return this._nxt_verb;
        }
      },
      move: {
        get: function() {
          return freeze({
            verb: this.verb,
            dpar: this.dpar,
            dest: this.dest
          });
        }
      },
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
          var R;
          if ((R = this._path) != null) {
            return R;
          }
          return this._path = this.up != null ? `${this.up.path}/${this.name}` : this.name;
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

  // #---------------------------------------------------------------------------------------------------------
  // _compile_handlers: ->
  //   ### TAINT add handlers for trigger, change ###
  //   ### TAINT check names against reserved ###
  //   try
  //     for category in [ 'before', 'enter', 'stay', 'leave', 'after', ]
  //       @_tmp.known_names.add category
  //       for name, handler of @_tmp.fsmd[ category ] ? {}
  //         @[ category ][ name ] = handler.bind @
  //   catch error
  //     error.message += " — Error occurred during @_compile_handlers with #{rpr { category, name, handler, }}"
  //     throw error
  //   return null

  // #---------------------------------------------------------------------------------------------------------
  // _compile_goto: ->
  //   @_tmp.known_names.add 'goto'
  //   if ( goto = @_tmp.fsmd.goto )?
  //     unless goto is '*'
  //       throw new Error "^intermatic/_compile_handlers@776^ expected '*' for key `goto`, got #{rpr goto}"
  //     transitioner  = @_get_transitioner 'goto', null
  //     goto          = ( dest, P... ) => transitioner dest, P...
  //     for dest in @lstates
  //       do ( dest ) =>
  //         goto[ dest ] = ( P... ) => transitioner dest, P...
  //     set @, 'goto', goto
  //   return null

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

  // #---------------------------------------------------------------------------------------------------------
  // _compile_subfsms: ->
  //   @_tmp.known_names.add 'fsms'
  //   fsm_names = []
  //   for sub_fname, sub_fsmd of @_tmp.fsmd.fsms ? {}
  //     sub_fsmd  = { sub_fsmd..., }
  //     if sub_fsmd.name? and sub_fsmd.name isnt sub_fname
  //       throw new Error "^intermatic/_compile_subfsms@506^ name mismatch, got #{rpr sub_fname}, #{rpr sub_fsmd.name}"
  //     sub_fsmd.name = sub_fname
  //     set sub_fsmd, 'up', @
  //     @_tmp.known_names.add sub_fname
  //     fsm_names.push   sub_fname
  //     set @, sub_fname, new @constructor sub_fsmd
  //   @fsm_names    = freeze fsm_names
  //   @has_subfsms  = fsm_names.length > 0
  //   return null

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

  // #---------------------------------------------------------------------------------------------------------
  // _copy_other_attributes: ->
  //   for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd
  //     continue if @_tmp.known_names.has pname
  //     Object.defineProperty @, pname, propd
  //   return null

  //###########################################################################################################
  module.exports = Intermatic;

  // if globalThis.require? then module.exports        = { Intermatic, }
// else                        globalThis.Intermatic = Intermatic

}).call(this);

//# sourceMappingURL=main.js.map