# Uboot

![https://uboot.io](https://uboot.io/assets/images/uboot_master.svg)

## Conquer the deep sea.

Uboot - Delightful distributed Messaging and State Management for JavaScript and TypeScript.

### [Looking for a complete documentation? Click here.](https://uboot.io)

## Why Uboot?

Nowadays, in web ond mobile software engineering we strive for a component based development. 

On the one hand, we as developers have the demand on ourselves to develop **loosely coupled systems**, on the other hand we want to **connect the components as tight as possible** to develop a complex overall system. An apparent contradiction.

- The components must communicate with each other. Often, however, there is no direct path from one component to the other, you have to build complicated paths and bridges that you don't really want to have. **Wouldn't it be nice if one component could simply call the other directly?**

- A loosely coupled system, consisting of a multitude of components, also has a distributed state. The components in turn have their own life cycle, so that the respective state of the component is created and destroyed. **Wouldn't it be nice to leave the state where it belongs - in the respective component, taking the life cycle into account?**

- **Wouldn't it be nice if the components could** not only communicate loosely and directly with each other, but could also **react directly with state changes - traceable and without side-effects?**

- **Wouldn't it be nice if all this would have a compact and elegant API?**

## The components of Uboot.

Uboot consists of an ***Ocean*** in which a large number of ***Uboots*** swim, each with a ***Radio*** in order to communicate with each other. Using the Radio, ***Messages*** of any type can be sent and received over a variety of ***Channels***. At any time new Uboots can be built or existing Uboots can be sunk. Each Uboot has a ***State*** which can be modified according to a ***Reducer*** when receiving messages.

## Setup

```sh
npm i @uboot/uboot
```
## Uboot API

### Create an Ocean

Usually an **Ocean** represents your entire application. In this case we create exactly one Ocean globally.

```ts
import { createOcean, Ocean } from '@uboot/uboot';

const ocean: Ocean = createOcean();
```

In rare cases an application can have more than one ocean.

### Create an Uboot

In the application we usually create a large number of **Uboots**.


Each Uboot has an **ID** and a **State**.

```ts
import { Uboot } from '@uboot';

const fooUboot: Uboot = ocean.uboot('foo', {});
```

It is a good idea to give the State a type.

```ts
interface UbootCounterState {
  counter: number;
}

const barUboot: Uboot<UbootCounterState> = ocean.uboot('bar', { counter: 0 });
```

### Access the State

It is very easy to access the state of an Uboot.

```ts
const counter = barUboot.state().counter;
```

Note that the state can only be read directly. The state of an Uboot can only be modified with a Reducer, as described later in this description.

### Receive Messages

Messages can be received over the radio via a channel.

The message can be of any known type (here: *string*).

```ts
const sub = barUboot.radio('greetings').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
  console.log(`Received "${msg}" from Uboot "${sender.id}".`);
});
```

Unsubscribe, if you're not longer interested in receiving Messages for this Uboot on the given Channel.

```ts
sub.unsubscribe();
```

### Sending Messages

Messages of any type are sent over the radio via a Channel (here: *greetings*).

```ts
const delivered = await fooUboot.radio('greetings').send<string>('Hey all uboots!');
```

Instead of sending the Message to all Uboots listening on the Channel (broadcast), you can also send it to selected Uboots.

```ts
const delivered = await fooUboot.radio('greetings').send<string>('Hey you!', ['zoo', 'bar']);
```
The result of this operation indicates which Uboots have received the Message successfully.

You might be interested in the error.

```ts
if (delivered.receiver.length !== 2 && delivered.error) {
  console.error(delivered.error);
}
```

### Changing the State

The state of a specific Uboot can only be modified by Reducers registered on a Channel for this Uboot.

```ts
const sub = barUboot.radio('add').mutate<number>((prevState, message) => {
  return { 
    ...prevState,
    counter: prevState.counter + message,
  };
});
```

Unsubscribe, if you're not longer interested in receiving Messages for this Uboot on the given Channel.

```ts
sub.unsubscribe();
```

The Reducer on this Uboot is triggered when a Message is sent through this Channel by any (other) Uboot.

```ts
let delivered = await fooUboot.radio('add').send(2);
```
### Sinking an Uboot

Finally, if you're done with an Uboot: Sink it. All subscriptions are closed.

```ts
ocean.sink('foo');
```

## That's it!

We're working on: *improving the documentation*, *examples*, *middleware concepts*, *React*, *Angular* and *Vue* bindings.

Stay tuned and ***conquer the deep sea***.
