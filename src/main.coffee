
'use strict'


############################################################################################################
types                     = new ( require 'intertype' ).Intertype()
{ validate
  isa
  declare }               = types.export()
freeze                    = Object.freeze
unless globalThis.debug?  then debug  = console.debug
unless globalThis.rpr?    then rpr    = JSON.stringify

#===========================================================================================================
# TYPES
#-----------------------------------------------------------------------------------------------------------
declare 'trajectory', tests:
  "x isa list of texts":      ( x ) -> @isa.list_of 'text', x
  "length is 0 or > 1":       ( x ) -> ( x.length is 0 ) or ( x.length > 1 )

#-----------------------------------------------------------------------------------------------------------
declare 'start_trajectory', tests:
  "x is either a trajectory or a lstate": ( x ) -> ( @isa.trajectory x ) or ( @isa.lstate x )

#-----------------------------------------------------------------------------------------------------------
declare 'verb', tests:
  "x isa nonempty_text":      ( x ) -> @isa.nonempty_text x
  # "x is not a reserved word": ( x ) ->
  # "x is not an lstate": ( x ) ->
  # or test against catalog of known verbs

#-----------------------------------------------------------------------------------------------------------
declare 'lstate', tests:
  "x isa nonempty_text":      ( x ) -> @isa.nonempty_text x
  # "x is not a reserved word": ( x ) ->
  # "x is not an verb": ( x ) ->
  # or test against catalog of known verbs

#-----------------------------------------------------------------------------------------------------------
declare 'goto_target', tests:
  "x is 'any'": ( x ) -> x is 'any'

#-----------------------------------------------------------------------------------------------------------
declare 'actions', tests:
  ### TAINT allow async functions ###
  "x isa list of functions":      ( x ) -> @isa.list_of 'function', x

#-----------------------------------------------------------------------------------------------------------
declare 'fsmd_multitrajectory', ( x ) ->
  return false unless @isa.list x
  return false unless @isa.list x[ 0 ]
  return @isa.list_of 'trajectory', x

#-----------------------------------------------------------------------------------------------------------
declare 'fsmd_moves', tests:
  "x is an object":               ( x ) -> @isa.object x
  "keys of x are verbs":          ( x ) -> ( Object.keys x ).every ( k ) => @isa.verb k
  "values of x are trajectories (or start_trajectories) or a list of those": ( x ) ->
    for k, v of x
      if k is 'start'
        return false unless @isa.start_trajectory v
        continue
      ### NOTE this allows lists of trajectories for verbs other than 'start' only ###
      return false unless ( @isa.trajectory v ) or ( @isa.fsmd_multitrajectory v )
    return true


#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
set = ( target, key, value ) ->
  if target[ key ] isnt undefined
    throw new Error "^intermatic/set@776^ name collision: #{rpr key}"
  target[ key ] = value
  return value

#-----------------------------------------------------------------------------------------------------------
push_circular = ( xs, x, max_length = 1 ) ->
  R = [ xs..., x, ]
  R.shift() while R.length > max_length
  return freeze R


#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
class Intermatic

  #---------------------------------------------------------------------------------------------------------
  @_tid: 0

  #---------------------------------------------------------------------------------------------------------
  constructor: ( fsmd ) ->
    # validate.fsmd fsmd
    # @_types             = types
    @_tmp               = {}
    @_tmp.fsmd          = { fsmd..., }
    @_tmp.known_names   = new Set()
    # @_mnames            = new Set()
    @moves              = null
    @cascades           = null
    @lstates            = null
    @fsm_names          = []
    @has_subfsms        = false
    @_stage             = null
    @_lstate            = 'void'
    @_trigger_stages    = freeze [ 'before', 'after', ]
    @_state_stages      = freeze [ 'entering', 'leaving', 'keeping', ]
    do =>
      for stages in [ @_trigger_stages, @_state_stages, ]
        set @, stage, {} for stage in stages
    @data               = null
    @history_length     = 1
    @_cancelled         = null
    @_prv_lstates       = [ @_lstate, ]
    @_prv_verbs         = []
    @_nxt_dpar          = null
    @_nxt_dest          = null
    @_nxt_verb          = null
    @up                 = null
    @_path              = null
    @_compile_fail()
    # @_compile_cyclers()
    @_compile_moves()
    @_compile_triggers()
    @_compile_actions()
    # @_compile_handlers()
    @_compile_goto()
    @_compile_can()
    @_compile_tryto()
    @_compile_subfsms()
    # @_compile_data()
    @_compile_cascades()
    @_copy_other_attributes()
    delete @_tmp
    return null

  #---------------------------------------------------------------------------------------------------------
  Object.defineProperties @prototype,
    #-------------------------------------------------------------------------------------------------------
    lstate:
      enumerable:     true
      get:            -> @_lstate
      set: ( lstate ) ->
        validate.lstate lstate
        @_prv_lstates = push_circular @_prv_lstates, lstate, @history_length + 1
        @_lstate      = lstate
    #-------------------------------------------------------------------------------------------------------
    cstate:
      enumerable:     true
      get: ->
        R                 = Object.assign {}, @move
        R.path            = x if ( x = @path )?
        R.data            = freeze { x..., } if ( x = @data )?
        R[ subfsm_name ]  = @[ subfsm_name ].cstate for subfsm_name in @fsm_names
        return freeze R
    #-------------------------------------------------------------------------------------------------------
    EXP_dstate:
      enumerable:     true
      get: ->
        target        = { lstate: @lstate, }
        R             = { [@name]: target, }
        target.data   = @data if @data?
        for subfsm_name in @fsm_names
          sub_fsm = @[ subfsm_name ]
          Object.assign target, sub_fsm.EXP_dstate
        freeze target
        return freeze R
    #-------------------------------------------------------------------------------------------------------
    stage:  get: -> @_stage
    verb:   get: -> @_nxt_verb
    dpar:   get: -> @_nxt_dpar
    dest:   get: -> @_nxt_dest
    #-------------------------------------------------------------------------------------------------------
    move:   get: ->
      R         = {}
      R.stage   = x if ( x = @stage   )?
      R.verb    = x if ( x = @verb    )?
      R.dpar    = x if ( x = @dpar    )?
      R.dest    = x if ( x = @dest    )?
      R.changed = x if ( x = @changed )? and x
      R.lstate  = @lstate
      R.failed  = true if ( @dpar? and not @dest? )
      return freeze R
    #-------------------------------------------------------------------------------------------------------
    fsms: get: -> ( @[ subfsm_name ] for subfsm_name in @fsm_names )
    #-------------------------------------------------------------------------------------------------------
    changed:
      get: ->
        return null unless @_nxt_dpar? and @_nxt_dest?
        return @_nxt_dpar isnt @_nxt_dest
    #-------------------------------------------------------------------------------------------------------
    path:
      get: ->
        return R if ( R = @_path )?
        return @_path = if @up? then "#{@up.path}/#{@name}" else @name ? null
    #-------------------------------------------------------------------------------------------------------
    history:
      get: ->
        R = []
        for verb, idx in @_prv_verbs
          dpar  = @_prv_lstates[ idx ]
          dest  = @_prv_lstates[ idx + 1 ]
          R.push freeze { verb, dpar, dest, }
        return freeze R

  #---------------------------------------------------------------------------------------------------------
  fail: ->
    throw new Error "^intermatic/fail@557^ trigger not allowed: #{rpr { name: @name, verb: @verb, dpar: @dpar, }}"

  #---------------------------------------------------------------------------------------------------------
  _compile_fail: ->
    @_tmp.known_names.add 'fail'
    return null unless ( fail = @_tmp.fsmd.fail )?
    @fail = fail.bind @
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_moves: ->
    @_tmp.known_names.add 'moves'
    # starred       = {}
    lstates       = new Set [ 'void', ]
    fsmd_moves    = @_tmp.fsmd.moves ? {}
    validate.fsmd_moves fsmd_moves
    fsmd_moves    = @_tmp.fsmd.moves = { fsmd_moves..., }
    @moves        = {}
    verbs         = ( verb for verb of fsmd_moves )
    #.......................................................................................................
    for verb, trajectory of fsmd_moves
      ### If the verb is `start`, then value may be just the name of the start verb instead of a list ###
      validate.verb verb
      if ( verb is 'start' ) and ( not isa.list trajectory )
        trajectory = [ 'void', trajectory, ]
      continue unless trajectory.length > 0
      #.....................................................................................................
      if isa.fsmd_multitrajectory trajectory
        @_compile_monotrajectory lstates, verb, monotrajectory for monotrajectory in trajectory
      else
        @_compile_monotrajectory lstates, verb, trajectory
    #.......................................................................................................
    @lstates = freeze [ lstates..., ]
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_monotrajectory: ( lstates, verb, trajectory ) ->
    for tidx in [ 0 ... trajectory.length - 1 ]
      ### TAINT validate that free of collision ###
      dpar  = trajectory[ tidx ]
      dest  = trajectory[ tidx + 1 ]
      #...................................................................................................
      lstates.add dpar
      lstates.add dest
      set ( @moves[ verb ] ?= {} ), dpar, dest
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_triggers: ->
    for verb, dests_by_deps of @moves
      do ( verb, dests_by_deps ) =>
        trigger = @_get_trigger verb, dests_by_deps
        set @, verb, trigger
        @_tmp.known_names.add verb
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_actions: ->
    #.......................................................................................................
    for stage in @_trigger_stages
      @_tmp.known_names.add stage
      continue unless ( source = @_tmp.fsmd[ stage ] )?
      target = @[ stage ]
      for verb, actions of source
        ### TAINT validate.verb verb; esp validate not an lstate ###
        validate.verb verb
        actions = [ actions, ] unless isa.list actions
        validate.actions actions
        set target, verb, actions
    #.......................................................................................................
    for stage in @_state_stages
      @_tmp.known_names.add stage
      continue unless ( source = @_tmp.fsmd[ stage ] )?
      target = @[ stage ]
      for lstate, actions of source
        ### TAINT validate.lstate lstate; esp validate not a verb ###
        validate.lstate lstate
        actions = [ actions, ] unless isa.list actions
        validate.actions actions
        set target, lstate, actions
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  _call_actions: ( stage, verb_or_lstate, P ) ->
    @_stage = stage
    return null unless ( transitioners = @[ stage ]?[ verb_or_lstate ] )?
    transitioner.apply @, P for transitioner in transitioners
    return null

  #---------------------------------------------------------------------------------------------------------
  _get_trigger: ( verb, dests_by_deps = null ) ->
    ### TAINT too much logic to be done at in run time, try to precompile more ###
    return transitioner = ( P... ) =>
      ### TAINT use single transitioner method for all triggers? ###
      @_nxt_verb      = verb
      ### TAINT consider to do this inside a property setter, as for `@lstate`: ###
      @_prv_verbs     = push_circular @_prv_verbs, verb, @history_length
      @_nxt_dpar      = dpar = @lstate
      #-------------------------------------------------------------------------------------------------
      if dests_by_deps? then    dest          = ( dests_by_deps[ dpar ] ? dests_by_deps.any ? null )
      else                    [ dest, P..., ] = P
      return @fail P... unless dest?
      #.....................................................................................................
      @_nxt_dest  = dest
      changed     = dest isnt dpar
      @_cancelled = false
      #.....................................................................................................
      if @cascades and @cascades.has verb
        for subfsm_name in @fsm_names
          @[ subfsm_name ].tryto verb, P...
      #.....................................................................................................
      loop
        # . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        @_call_actions 'before',    'any',      P;                  break if @_cancelled
        @_call_actions 'before',    'change',   P if      changed;  break if @_cancelled
        @_call_actions 'before',    verb,       P;                  break if @_cancelled
        # . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        @_call_actions 'leaving',   'any',      P if      changed;  break if @_cancelled
        @_call_actions 'leaving',   dpar,       P if      changed;  break if @_cancelled
        #...................................................................................................
        @lstate = dest if changed
        #...................................................................................................
        @_call_actions 'keeping',   'any',      P if  not changed;  break if @_cancelled
        @_call_actions 'keeping',   dpar,       P if  not changed;  break if @_cancelled
        # . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        @_call_actions 'entering',  'any',      P if      changed;  break if @_cancelled
        @_call_actions 'entering',  dest,       P if      changed;  break if @_cancelled
        # . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        @_call_actions 'after',     'any',      P;                  break if @_cancelled
        @_call_actions 'after',     'change',   P if      changed;  break if @_cancelled
        @_call_actions 'after',     verb,       P;                  break if @_cancelled
        # . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        break
      #.....................................................................................................
      if @_cancelled
        debug '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> CANCELLED <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'
        ### TAINT not yet implemented ###
        ### TAINT should be done in a method ###
        ### TAINT alternatively consider to change values in temp object, only push to history when succesfull ###
        # @_prv_lstates.pop()
        # @_prv_verbs.pop()
        # @_lstate = @_nxt_dpar
        # debug @cstate
      #.....................................................................................................
      ### NOTE At this point, the transition has finished, so we reset the `@_nxt_*` attributes: ###
      @_cancelled = null
      @_stage     = null
      @_nxt_verb  = null
      @_nxt_dest  = null
      @_nxt_dpar  = null
      #.....................................................................................................
      return null

  #---------------------------------------------------------------------------------------------------------
  cancel: ->
    throw new Error "^intermatic/cancel@886^ can only cancel during move" unless @_stage?
    @_cancelled = true
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_goto: ->
    @_tmp.known_names.add 'goto'
    if ( goto = @_tmp.fsmd.goto )?
      validate.goto_target goto
      transitioner  = @_get_trigger 'goto', null
      goto          = ( dest, P... ) => transitioner dest, P...
      for dest in @lstates
        do ( dest ) =>
          goto[ dest ] = ( P... ) => transitioner dest, P...
      set @, 'goto', goto
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_can: ->
    @_tmp.known_names.add 'can'
    #.......................................................................................................
    can = ( verb ) =>
      unless ( transitions = @moves[ verb ] )?
        throw new Error "^intermatic/can@822^ unknown verb #{rpr verb}"
      return transitions[ @lstate ]?
    #.......................................................................................................
    can_proxy = new Proxy can,
      get: ( target, key ) -> ( -> target key )
    #.......................................................................................................
    set @, 'can', can_proxy
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_tryto: ->
    @_tmp.known_names.add 'tryto'
    tryto = ( verb, P... ) =>
      return false unless @can verb
      @[ verb ] P...
      return true
    #.......................................................................................................
    tryto_proxy = new Proxy tryto,
      get: ( target, key ) -> ( ( P... ) -> target key, P... )
    #.......................................................................................................
    set @, 'tryto', tryto_proxy
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_subfsms: ->
    @_tmp.known_names.add 'fsms'
    fsm_names = []
    for sub_fname, sub_fsmd of @_tmp.fsmd.fsms ? {}
      sub_fsmd  = { sub_fsmd..., }
      if sub_fsmd.name? and sub_fsmd.name isnt sub_fname
        throw new Error "^intermatic/_compile_subfsms@506^ name mismatch, got #{rpr sub_fname}, #{rpr sub_fsmd.name}"
      sub_fsmd.name = sub_fname
      set sub_fsmd, 'up', @
      @_tmp.known_names.add sub_fname
      fsm_names.push   sub_fname
      set @, sub_fname, new @constructor sub_fsmd
    @fsm_names    = freeze fsm_names
    @has_subfsms  = fsm_names.length > 0
    return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_data: ->
  #   @_tmp.known_names.add 'data'
  #   return null unless ( data = @_tmp.fsmd.data )?
  #   @data = {}
  #   for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd.data
  #     Object.defineProperty @data, pname, propd
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_cascades: ->
  #   @_tmp.known_names.add 'cascades'
  #   return null unless ( cascades = @_tmp.fsmd.cascades )?
  #   @cascades = new Set cascades
  #   return null

  #---------------------------------------------------------------------------------------------------------
  _copy_other_attributes: ->
    for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd
      continue if @_tmp.known_names.has pname
      Object.defineProperty @, pname, propd
    return null


############################################################################################################
module.exports = Intermatic
# if globalThis.require? then module.exports        = { Intermatic, }
# else                        globalThis.Intermatic = Intermatic



