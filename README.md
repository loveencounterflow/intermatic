


# 🄸🄽🅃🄴🅁🄼🄰🅃🄸🄲

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

  - [Finite State Machine Description Objects (FSMDs)](#finite-state-machine-description-objects-fsmds)
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
      enter:
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
      * `enter`
      * `stay`
      * `leave`
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

* **departures** (`dpar`), **destinations** (`dest`) are the local states where a transition—a *move*—starts
  and ends, respectively;
* **verbs** are what triggers an FSM to change state.
* A **move** (a.k.a. *transition*) is a triplet of `( verb, dpar, dest, )` (think: "to `melt` (a
  substance) means going from `solid` to `liquid` state", which describes the transition `( 'melt', 'solid',
  'liquid', )`). A given verb may connect a number of departures and destinations, and a given verb may
  connect several departures with several destinations; however, given a verb and a departure state, there
  can only be up to one destination state.

* `fsm.history`

* Multiple terminal states are not a problem.


```
fsm = {
  foobar: {
    triggers: [ ... ],
    before:   { ... },
    enter:    { ... },
    ... }
```

```
fsm = {
  name:     'foobar',
  triggers: [ ... ],
  before:   { ... },
  enter:    { ... },
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
    enter:    { ... },
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
  enter:
    dark:       ( s ) -> register "enter dark:    #{rpr s}"
  leave:
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

# To Do

* [ ] implement `goto` with list of target (or source and target?) states
* [ ] implement `toggle`
* [ ] implement trigger cancellation (using API call, not return value)
* [ ] discuss namespaces: trigger names and names of sub-FSMs originate in different parts of an FSMD but
  end up sharing one namespace when the FSM is constructed
* [ ] percolate/bubble triggers (from sub to up? both directions? all FSMs in tree?)
* [ ] when one trigger bubbles through the FSMs, how to tell when that trigger has been processed? Two
  consecutive events could have same name. Use ID?
* [X] implement `fsm.tryto 't'` to call trigger `t` only when allowed, avoiding calls to `fail()`
* [X] implement `fsm.can 't'` to test whether trigger `t` may be emitted from current state
* [X] implement attribute-access (cf. `Multimix`) for `goto`, `tryto` such that `fsm.goto 's'`, `fsm.tryto
  't'` is equivalent to `fsm.goto.s()`, `fsm.tryto.t()`
* [ ] implement cascading events, such that `top.start()` implicitly calls `start()` on all sub-FSMs
* [ ] asynchronous moves
* [ ] equivalents to `setTiemout()`, `setInterval()`?
* [ ] make symbolic `'*'` equivalent to `'any'`
* [ ] rename FSMD attribute `triggers` to `moves`, use `{ verb, dpar, dest, }` format
* [ ] remove `s`/`trigger` argument from event handlers


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