


# 🄸🄽🅃🄴🅁🄼🄰🅃🄸🄲

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

  - [Finite State Machine Description Objects (FSMDs)](#finite-state-machine-description-objects-fsmds)
- [Lifecycle of Intermatic FSMs](#lifecycle-of-intermatic-fsms)
- [To Do](#to-do)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

**work in progress**

state machine for NodeJS and the browser

* `fsm.goto = ( to_sname ) -> ...` will be present when an entry `goto: '*'` is present in the top level
  of the FSMD.

* FSMs can be nested, with a sub-FSM `lamp` declared *in the FSM description* as `fsmd.subs.lamp`, and
  referred to *in the FSM instance* simply by `fsm.lamp`.

* The parent FSM can be referred to from the sub-FSM via its attrbute `up`, so that e.g. `button.lamp.up` is
  identical to `button`.

* **NOTE** in the future, some of the details of declaring and referring to sub-FSMs may change.

* Nested FSMs thus provide namespaces. For example, an appliance with three buttons `alpha_btn`, `beta_btn`,
  `gamma_btn` can have one `lamp` for each button which will be referred to as `alpha_btn.lamp`,
  `beta_btn.lamp`, `gamma_btn.lamp`. The definition of each `lamp` can be identical (or variants along the
  same pattern), yet act independently of the other `lamp`s.

* Nested FSMs are also a measure to deal with the [combinatorial state
  explosion](https://en.wikipedia.org/wiki/Combinatorial_explosion).

* The state of an FSM is
  * represented *locally* as a JS value / string ??? from 'inside';
  * for the outside, it is a key/value pair, implemented as an object with the FSM's name as sole attribute,
    so if a `lamp` is `lit`, that gives `{ lamp: 'lit', }`

```
alpha_btn:
  ...
  my:
    lamp:
      cyclers:
        toggle: [ 'lit', 'dark', ]
    label:
      values:
        id:     {
          G: { text: 'go',    color: 'green', },
          W: { text: 'wait',  color: 'amber', },
          S: { text: 'stop',  color: 'red',   }, }
      entering:
        id:
          G: { }

```

## Finite State Machine Description Objects (FSMDs)

* In order to instantiate an FSM, use `new Intermatic fsmd` where `fsmd` is an object that describes the
  details of the state machine—a **F**inite **S**tate **M**achine **D**escription.

* The fields of an FSMD are:

  * Declaring triggers:
    * `triggers`
    * `cyclers` (Not Implemented)

  * Lifecycle Attributes:

    * LAs concerning triggers:
      * `before`
      * `after`

    * LAs concerning states:
      * `entering`
      * `keeping`
      * `leaving`
      * `change`

  * specials:
    * `goto`
    * `name`
  * custom:
    * all attributes and properties except those mentioned above will be copied from the FSMD to the
      resulting FSM, preserving their [property
      descriptors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty),
      meaning that things like computed properties, proxies, read-only values &c. will be preserved.

<!-- All Intermatic FSMs are 'potentially compound', i.e. an Intermatic instance can always potentially hold  -->

* An Intermatic compound FSM (cFSM) has a tree structure
* which implies that there must be exactly one root object.
* The root object is always an FSM; however,
* like any FSM, the root FSM can be 'empty' (i.e. have no other functionality than a `start()` method which
  transitions from the implicit `void` to the same `void` state);
* the root FSM may or may not have a name (be named or anonymous)
* and may contain zero or more sub-FSMs
* all of which must be named.
* Compound and simple FSMs are instances of `Intermatic`,
* simple FSMs do not have sub-FSMs under attribute `my` in their FSMDs, but
* compound FSMs *do* have one or more sub-FSMs declared under their FSMD's `my` attribute.
* Since attribute `fsmd.my` must be an object when defined, it follows that all sub-FSMs must implicitly
  have unique names.

* Unreachable states are states that can not be reached by any kind of proper (named) trigger;
* these make sense only for FSMs that have a `goto()` method.
* Unreachable states cause an error on instantiation unless licensed in the configuration (FSMD) by setting
  `unreachable: true`.

* **departures** (`dpar`), **destinations** (`dest`) are the local states where a transition─a *move*─starts
  and ends, respectively;
* **verbs** are what triggers an FSM to change state.
* Specifically, the methods that are compiled from the verbs found as keys in an FSMD's `moves` object are
  called **triggers** because they are used to trigger a single transition from one state to another state.
* Triggers accept any number of arguments; these will be passed into the state and trigger actions.
* **State Actions** are methods that are called when a state is entered or left.
* **Trigger Actions** are methods that are called before or after a trigger has caused a transition.
* Actions are associated with tuples `( stage, cause )`, where a cause is either a verb or a local state.
  The stages associated with trigger actions are `'before'` and `'after'`; the stages associated with state
  actions are `entering`, `leaving`, and `keeping`. Thus an action associated with `( 'before', 'start' )`
  will be called (as implicit) *before* the transition to be caused by calling the trigger *start* is
  performed; an action associated with `( 'leaving', 'green' )` will be called whenever the local state is
  `'green'` and a transition is about to change that.
* A **trajectory** is a (possibly empty) list of local states. It must satisfy a number of constraints:
  * A trajectory list must have either no elements or more than one element.
  * The elements in a trajectory list are interpreted in a pair-wise fashion such that the `i`th element
    becomes the departure and the `i + 1`th element the destination of an **elemntary trajectory** a.k.a. a
    **transition**. For example, the trajectory `[ 'a', 'b', 'c', ]` contains the transitions from departure
    `a` to destination `b`, and the transition from `b` to `c`.
  * It is not allowed to repeat any element of a trajectory except for the case of circular trajectory
    (**cycles**) where the *last* element repeats the first element. For example, `[ 'a', 'b', 'c', 'a', ]`
    denotes a trajectory from `a` through `b` through `c`, and then from `c` back to `a`.
  * The first element of a trajectory list (and only the first one) may be the catch-all symbol (written as
    `'*'` or `'any'`); this signifies that the verb may be called in any state and will then transition to
    the second element in the list.
* A **move** is a key/value pair whose key is a verb and whose value is a trajectory.

* A given verb may connect a number of departures and destinations, and a given verb may connect several
  departures with several destinations; however, given a verb and a departure state, there can only be up to
  one destination state.

* **actions** are (synchronous or asynchronous) functions that are called in response to actions having taken
  or about to take place

* Verbs mentioned in the **fsmd.cascades** attributes will be called on all sub-FSMs.

* `fsm.history`

* Multiple terminal states are not a problem.


```
fsm = {
  foobar: {
    triggers: [ ... ],
    before:   { ... },
    entering:    { ... },
    ... }
```

```
fsm = {
  name:     'foobar',
  triggers: [ ... ],
  before:   { ... },
  entering:    { ... },
  ... }
```

or an object with

or

```
fsm = {
  foobar: {
    name:     'foobar',
    triggers: [ ... ],
    before:   { ... },
    entering:    { ... },
    ... }
```


```coffee
fsm_1 = new Intermatic { subs: { foo: { ... }, bar: { ... }, }  }
fsm_1 = new Intermatic { foo: { ... },              }
fsm_2 = new Intermatic { foo: { ... }, bar: { ... } }
````



 * `{ alpha_btn: { lamp: 'lit', color: 'green', label: 'go', } }`

```coffee
fsmd =
  name: 'meta_lamp'
  triggers: [
    [ 'void',   'start',  'lit',  ] # trigger № 1
    [ '*',      'reset',  'void', ] # trigger № 2
    [ 'lit',    'toggle', 'dark', ] # trigger № 3
    [ 'dark',   'toggle', 'lit',  ] # trigger № 4
  cyclers:
    toggle: [ 'lit', 'dark', ] # not yet implemented, alternative to triggers №s 3, 4
  after:
    change:     ( s ) -> register "after change:  #{rpr s}"
  entering:
    dark:       ( s ) -> register "entering dark:    #{rpr s}"
  leaving:
    lit:        ( s ) -> register "leave lit      #{rpr s}"
  goto:         '*'
  fail:         ( s ) -> register "failed: #{rpr s}"
#---------------------------------------------------------------------------------------------------------
{ Intermatic, } = require '../../../apps/intermatic'
fsmd            = fsmd
fsm             = new Intermatic fsmd
fsm.start()
fsm.toggle()
fsm.reset()
fsm.toggle()
fsm.goto 'lit'
```

# Lifecycle of Intermatic FSMs

```
   ┌─────────────╥───────────────────────────────────────────────────────┐
 1 │      called ║ called by FSM                                         │
 2 │     by User ║────────────────────┬──────────────────────────────────│
 3 │             ║                    │fsm.  │ fsm.move.                 │
 4 │             ║                    │lstate│──────┬──────┬──────┬──────│
 5 │             ║            actions │      │ stage│ verb │ dpar │ dest │
 6 │             ║                    │      │      │      │      │      │
 7 │═════════════║════════════════════╪══════╪══════╪══════╪══════╪══════│
 8 │             ║                    │ void │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
 9 │─────────────║────────────────────│ void │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
10 │   φ.start() ║                    │ void │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
11 │             ║   φ.before.any[]() │ void │ bfr. │ start│ void │ a    │
12 │             ║φ.before.change[]() │ void │ bfr. │ start│ void │ a    │
13 │             ║ φ.before.start[]() │ void │ bfr. │ start│ void │ a    │
14 │             ║  φ.leaving.any[]() │ void │ lvg. │ start│ void │ a    │
15 │             ║ φ.leaving.void[]() │ void │ lvg. │ start│ void │ a    │
16 │             ║────────────────────│──────│ lvg. │ start│ void │ a    │
17 │             ║ φ.entering.any[]() │ a    │ ent. │ start│ void │ a    │
18 │             ║   φ.entering.a[]() │ a    │ ent. │ start│ void │ a    │
19 │             ║    φ.after.any[]() │ a    │ aftr.│ start│ void │ a    │
20 │             ║ φ.after.change[]() │ a    │ aftr.│ start│ void │ a    │
21 │             ║  φ.after.start[]() │ a    │ aftr.│ start│ void │ a    │
22 │─────────────║────────────────────│ a    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
23 │    φ.step() ║                    │ a    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
24 │             ║   φ.before.any[]() │ a    │ bfr. │ step │ a    │ b    │
25 │             ║φ.before.change[]() │ a    │ bfr. │ step │ a    │ b    │
26 │             ║  φ.before.step[]() │ a    │ bfr. │ step │ a    │ b    │
27 │             ║  φ.leaving.any[]() │ a    │ lvg. │ step │ a    │ b    │
28 │             ║    φ.leaving.a[]() │ a    │ lvg. │ step │ a    │ b    │
29 │             ║────────────────────│──────│ lvg. │ step │ a    │ b    │
30 │             ║ φ.entering.any[]() │ b    │ ent. │ step │ a    │ b    │
31 │             ║   φ.entering.b[]() │ b    │ ent. │ step │ a    │ b    │
32 │             ║    φ.after.any[]() │ b    │ aftr.│ step │ a    │ b    │
33 │             ║ φ.after.change[]() │ b    │ aftr.│ step │ a    │ b    │
34 │             ║   φ.after.step[]() │ b    │ aftr.│ step │ a    │ b    │
35 │─────────────║────────────────────│ b    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
36 │    φ.step() ║                    │ b    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
37 │             ║   φ.before.any[]() │ b    │ bfr. │ step │ b    │ c    │
38 │             ║φ.before.change[]() │ b    │ bfr. │ step │ b    │ c    │
39 │             ║  φ.before.step[]() │ b    │ bfr. │ step │ b    │ c    │
40 │             ║  φ.leaving.any[]() │ b    │ lvg. │ step │ b    │ c    │
41 │             ║    φ.leaving.b[]() │ b    │ lvg. │ step │ b    │ c    │
42 │             ║────────────────────│──────│ lvg. │ step │ b    │ c    │
43 │             ║ φ.entering.any[]() │ c    │ ent. │ step │ b    │ c    │
44 │             ║   φ.entering.c[]() │ c    │ ent. │ step │ b    │ c    │
45 │             ║    φ.after.any[]() │ c    │ aftr.│ step │ b    │ c    │
46 │             ║ φ.after.change[]() │ c    │ aftr.│ step │ b    │ c    │
47 │             ║   φ.after.step[]() │ c    │ aftr.│ step │ b    │ c    │
48 │─────────────║────────────────────│ c    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
49 │    φ.step() ║                    │ c    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
50 │             ║   φ.before.any[]() │ c    │ bfr. │ step │ c    │ c    │
51 │             ║  φ.before.step[]() │ c    │ bfr. │ step │ c    │ c    │ # NOTE that `before.change`
52 │             ║  φ.keeping.any[]() │ c    │ keep.│ step │ c    │ c    │ # and `after.change` are
53 │             ║    φ.keeping.c[]() │ c    │ keep.│ step │ c    │ c    │ # missing here b/c lstate
54 │             ║    φ.after.any[]() │ c    │ aftr.│ step │ c    │ c    │ # is kept at `c`
55 │             ║   φ.after.step[]() │ c    │ aftr.│ step │ c    │ c    │
56 │─────────────║────────────────────│ c    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
57 │    φ.stop() ║                    │ c    │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
58 │             ║   φ.before.any[]() │ c    │ bfr. │ stop │ c    │ void │
59 │             ║φ.before.change[]() │ c    │ bfr. │ stop │ c    │ void │
60 │             ║  φ.before.stop[]() │ c    │ bfr. │ stop │ c    │ void │
61 │             ║  φ.leaving.any[]() │ c    │ lvg. │ stop │ c    │ void │
62 │             ║    φ.leaving.c[]() │ c    │ lvg. │ stop │ c    │ void │
63 │             ║────────────────────│──────│ lvg. │ stop │ c    │ void │
64 │             ║    φ.after.any[]() │ void │ aftr.│ stop │ c    │ void │
65 │             ║ φ.after.change[]() │ void │ aftr.│ stop │ c    │ void │
66 │             ║   φ.after.stop[]() │ void │ aftr.│ stop │ c    │ void │
67 │             ║                    │ void │╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│╳╳╳╳╳╳│
   └─────────────╨────────────────────┴──────┴──────┴──────┴──────┴──────┘
```

> *Note: in the above, `x[]()` denotes a call to all the functions in the list of functions identified by
> `x`. `x[]()` corresponds to `x: [(->)]` in the below FSMD.*

```
fsmd =
  name: 'φ'
  moves: [
    start:    [ 'void', 'a', ]
    step:     [ 'a', 'b', 'c', 'c', ]
    stop:     [ 'c', 'void', ]
  start:
    before:   [(->)]
    after:    [(->)]
  step:
    before:   [(->)]
    after:    [(->)]
  stop:
    before:   [(->)]
    after:    [(->)]
  a:
    entering:    [(->)]
    leaving:     [(->)]
  b:
    entering:    [(->)]
    leaving:     [(->)]
  c:
    entering:    [(->)]
    keeping:     [(->)]
    leaving:     [(->)]
```

> *NOTE: in the above, `[(->)]` denotes a value consisting of either single function or a (possibly empty)
> list of functions.*


# To Do

* [X] implement `fsm.tryto 't'` to call trigger `t` only when allowed, avoiding calls to `fail()`
* [X] implement `fsm.can 't'` to test whether trigger `t` may be emitted from current state
* [X] implement attribute-access (cf. `Multimix`) for `goto`, `tryto` such that `fsm.goto 's'`, `fsm.tryto
  't'` is equivalent to `fsm.goto.s()`, `fsm.tryto.t()`
* [X] remove `s`/`trigger` argument from event handlers
* [X] Implement computed property `move` as `{ verb, dpar, dest, }`

------------------------------------------------------------------------------------------------------------

* [ ] use lists of functions when compiling actions (allowing FSMDs to define either a list of functions or
  else a single function that compiles into a list with one element)
* [ ] **REJECTED** should we unify `before` and `entering`, `after` and `leaving`? Possible setup uses 4 categories as opposed
  to the 5 now in use (`before`, `after`, `entering`, `leaving`, `keeping`):
  * `before`—for trigger actions, called before move is started
  * `keeping`—for state actions, only called when `dpar` equals `dest`
  * `entering`, `leaving`—for state actions, only called when `dpar` is different from `dest`
  * `after`—for trigger actions, called after move has finished

* [ ] implement `goto` with list of target (or source and target?) states
* [ ] implement `toggle`
* [ ] implement trigger cancellation (using API call, not return value)
* [ ] discuss namespaces: trigger names and names of sub-FSMs originate in different parts of an FSMD but
  end up sharing one namespace when the FSM is constructed
* [ ] percolate/bubble triggers (from sub to up? both directions? all FSMs in tree?)
* [ ] when one trigger bubbles through the FSMs, how to tell when that trigger has been processed? Two
  consecutive events could have same name. Use ID?
* [x] implement cascading events, such that `top.start()` implicitly calls `start()` on all sub-FSMs
* [ ] asynchronous moves
* [ ] equivalents to `setTimeout()`, `setInterval()`?
* [ ] make symbolic `'*'` equivalent to `'any'`
* [ ] rename FSMD attribute `triggers` to `moves`
* [ ] one of the following:
  * [ ] use `{ verb, dpar, dest, }` format
  * [ ] use lists with optionally more than three elements; a `step` action that goes from `a` to `b` to
    `c`, then stays at `c` would be `[ 'step', 'a', 'b', 'c', 'c' ]`; a cycler would be `[ 'cycle', 'a',
    'b', 'c', 'a', ]`; this would obsolete FSMD attribute `cyclers`
* [ ] state to be separated into three computed properties:
  * `lstate`(?) for local state: just the text (value) indicating the state of that component
  * `clstate`(?) for compound state with local states: object with `lstate` attributes for FSM and sub-FSMs
  * `ccstate`(?) more complete state including history (?)

* [ ] make `fsm.history` return list of `@move` objects, do not construct new data type
* [ ] remove `index.*` as those files are no longer needed

<!--
* [ ] consider using more flexible, clearer(?) syntax where triggers may be grouped as seen fit, ex.:
  ```
  triggers:
    from:
      'void':  { via: 'start', to: 'lit', }
    via:
      'toggle': [
        { from: 'lit', to: 'dark',  }
        { from: 'dark', to: 'lit',  }
        ]
      'reset': { to: 'void', }
    to:
      'lit': { from: 'dark', via: 'switch_on' }
  ```
 -->