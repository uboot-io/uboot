import { Ocean, createOcean } from './Uboot';
import { Uboot, UbootChannelSubscription, UbootChannelSubscriptionType, UbootMessageReceiver, UbootMiddleware, UbootRadio, UbootReducer } from './Uboot.types';

class MiddlewareUboot<TState = {}> implements Uboot<TState> {

  constructor(private readonly _uboot: Uboot<TState>) {
    this.radio = jest.fn(this.radio);
    this.state = jest.fn(this.state);
  }

  get id(): string {
    return this._uboot.id;
  }

  radio(channelId: string): UbootRadio<TState> {
    return this._uboot.radio(channelId);
  }
  state(): TState {
    return this._uboot.state();
  }
}

class MiddlewareUbootChannelSubscription implements UbootChannelSubscription {

  constructor(private readonly _ubootChannelSubscription: UbootChannelSubscription) {
    this.unsubscribe = jest.fn(this.unsubscribe);
  }

  get type(): UbootChannelSubscriptionType {
    return this._ubootChannelSubscription.type;
  }

  unsubscribe(): void {
    return this._ubootChannelSubscription.unsubscribe();
  }

  get open(): boolean {
    return this._ubootChannelSubscription.open;
  }
}

class MockUbootMiddleware implements UbootMiddleware {
  _uboot<TState>(uboot: Uboot<TState>): Uboot<TState> {
    return new MiddlewareUboot(uboot);
  }
  _channelSubscription(subscription: UbootChannelSubscription): UbootChannelSubscription {
    return new MiddlewareUbootChannelSubscription(subscription);
  }
  _messageReceiver<TMessage>(messageReceiver: UbootMessageReceiver<TMessage, any, any>): UbootMessageReceiver<TMessage, any, any> {
    return messageReceiver;
  }
  _reducer<TState, TMessage>(reducer: UbootReducer<TState, TMessage>): UbootReducer<TState, TMessage> {
    return reducer;
  }
  _radio<TState>(radio: UbootRadio<TState>): UbootRadio<TState> {
    return radio;
  }
  _ocean(ocean: Ocean): Ocean {
    return ocean;
  }
}

describe('Basic Uboot Middleware functionality', () => {

  let ocean: Ocean;

  beforeEach(() => {
    ocean = createOcean(new MockUbootMiddleware());
  });

  test('Uboot operation interception', () => {
    const fooUboot: Uboot = ocean.uboot('foo', {});

    // check if the fooUboot has the same Id
    expect(fooUboot.id).toBe('foo');

    // invoke the state() operation
    expect(fooUboot.state()).toEqual({});

    // check if the state() operation has been intercepted by the middleware
    // assumption: only the middleware declared above uses jest spies.
    expect(fooUboot.state).toHaveBeenCalledTimes(1);
    expect(fooUboot.state).toHaveReturnedWith({});

    // invoke the radio() operation
    const radio = fooUboot.radio('xy');
    expect(radio).toBeDefined();

    // check if the radio() operation has been intercepted by the middleware
    // assumption: only the middleware declared above uses jest spies.
    expect(fooUboot.radio).toHaveBeenCalledTimes(1);
    expect(fooUboot.radio).toHaveBeenCalledWith('xy');
    expect(fooUboot.radio).toHaveReturnedWith(radio);
  });

});
