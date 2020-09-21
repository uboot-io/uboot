import {
  UbootChannelSubscription,
  Uboot,
  UbootMessageReceiver,
  UbootRadio,
  UbootRadioResult,
  Ocean,
  UbootMiddleware,
  UbootReducer,
  UbootChannelSubscriptionType,
  ChannelId,
  UbootId,
  UbootRadioConfig,
} from './Uboot.types';

export * from './Uboot.types';

interface SubscriptionCleanupFunction {
  (): void;
}

class _UbootChannelSubscription implements UbootChannelSubscription {
  private _open = true;

  constructor(
    public readonly type: UbootChannelSubscriptionType,
    public readonly ubootId: UbootId,
    public readonly channelId: ChannelId,

    private readonly _cleanup: SubscriptionCleanupFunction,
  ) {}

  get open(): boolean {
    return this._open;
  }

  unsubscribe(): void {
    if (this._open) {
      this._cleanup();
      this._open = false;
    }
  }
}

class _Uboot<TState> implements Uboot<TState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  private readonly _radioForChannel: Record<ChannelId, _UbootRadio<TState>> = {};

  private _subscriptions: _UbootChannelSubscription[] = [];

  private _state: TState;

  constructor(
    public readonly id: UbootId,
    private readonly _ocean: _Ocean,
    readonly initialState: TState,
  ) {
    this._state = initialState;
  }

  state(): TState {
    return this._state;
  }

  applyReducer<TMessage>(reducer: UbootReducer<TState, TMessage>, message: TMessage): void {
    this._state = reducer(this._state, message);
  }

  radio(channelId: ChannelId): _UbootRadio<TState> {
    let radio = this._radioForChannel[channelId];
    if (!radio) {
      radio = this._ocean.mwm._radio(new _UbootRadio<TState>(channelId, this._ocean, this));
      this._radioForChannel[channelId] = radio;
    }
    return radio;
  }

  closeAllSubscriptions(): void {
    this._subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  attachSubscription(subscription: _UbootChannelSubscription): void {
    this._subscriptions.push(subscription);
  }

  detachSubscription(subscription: _UbootChannelSubscription): void {
    this._subscriptions = this._subscriptions.filter(
      (_subscription) => _subscription !== subscription,
    );
  }
}

class _Ocean implements Ocean {
  private readonly _uboots: Record<UbootId, _Uboot<any>> = {};
  private readonly _ubootsForChannel: Record<ChannelId, UbootId[]> = {}; // channelId -> ubootId[]

  constructor(public readonly mwm: UbootMiddlewareManager) {}

  uboot<TState>(ubootId: UbootId, initialState: TState): _Uboot<TState> {
    let uboot = this._uboots[ubootId] ? (this._uboots[ubootId] as _Uboot<TState>) : null;
    if (!uboot) {
      uboot = this.mwm._uboot<TState>(new _Uboot<TState>(ubootId, this, initialState));
      this._uboots[ubootId] = uboot;
    }
    return uboot;
  }

  sink(ubootId: UbootId): void {
    let uboot = this._uboots[ubootId];
    if (uboot) {
      uboot.closeAllSubscriptions();
      delete this._uboots[ubootId]; // shouldn't be nessecary, it's already done by the cleanup function of the subscription
    }
  }

  attachUbootToChannel(ubootId: UbootId, channelId: ChannelId): void {
    let ubootsForChannel = this._ubootsForChannel[channelId];
    if (!ubootsForChannel) {
      ubootsForChannel = [ubootId];
    } else {
      ubootsForChannel =
        ubootsForChannel.indexOf(ubootId) < 0 ? [...ubootsForChannel, ubootId] : ubootsForChannel;
    }
    this._ubootsForChannel[channelId] = ubootsForChannel;
  }

  detechUBootFromChannel(ubootId: UbootId, channelId: ChannelId): void {
    let ubootsForChannel = this._ubootsForChannel[channelId];
    if (ubootsForChannel) {
      ubootsForChannel = ubootsForChannel.filter((id) => id !== ubootId);
      this._ubootsForChannel[channelId] = ubootsForChannel;
    }
  }

  async send<TMessage>(
    channelId: ChannelId,
    fromUbootId: UbootId,
    message: TMessage,
    forUbootId: UbootId | UbootId[],
  ): Promise<UbootRadioResult<TMessage>> {
    const result: UbootRadioResult<TMessage> = {
      received: message,
      receiver: [],
    };
    const ubootsForChannel = this._ubootsForChannel[channelId];
    if (ubootsForChannel) {
      const _forUbootIds: UbootId[] = Array.isArray(forUbootId) ? forUbootId : [forUbootId];
      _forUbootIds.forEach((_forUbootId) => {
        const hasUbootForChannel = !!ubootsForChannel.find((ubootId) => ubootId === _forUbootId);
        if (hasUbootForChannel) {
          const fromUboot = this._uboots[fromUbootId];
          const forUboot = this._uboots[_forUbootId];

          try {
            // this line may throw excaptions
            forUboot.radio(channelId).apply(message, fromUboot);

            result.receiver.push(forUboot.id);
          } catch (error) {
            result.error = result.error
              ? { ...result.error, [_forUbootId]: error }
              : { [_forUbootId]: error };
          }
        }
      });
    }
    return result;
  }

  async broadcast<TMessage>(
    channelId: ChannelId,
    fromUbootId: UbootId,
    message: TMessage,
  ): Promise<UbootRadioResult<TMessage>> {
    const result: UbootRadioResult<TMessage> = {
      received: message,
      receiver: [],
    };
    const ubootsForChannel = this._ubootsForChannel[channelId];
    if (ubootsForChannel) {
      ubootsForChannel.forEach((forUbootId) => {
        const fromUboot = this._uboots[fromUbootId];
        const forUboot = this._uboots[forUbootId];

        try {
          // this line may throw excaptions
          forUboot.radio(channelId).apply(message, fromUboot);

          result.receiver.push(forUboot.id);
        } catch (error) {
          result.error = result.error
            ? { ...result.error, [forUbootId]: error }
            : { [forUbootId]: error };
        }
      });
    }
    return result;
  }
}

class _UbootRadio<TState> implements UbootRadio<TState> {
  private readonly _receiver: UbootMessageReceiver<any>[] = [];
  private readonly _reducer: UbootReducer<TState, any>[] = [];

  constructor(
    public readonly channelId: ChannelId,
    private readonly _ocean: _Ocean,
    private readonly _uboot: _Uboot<TState>,
    private _config: UbootRadioConfig = {},
  ) {}

  get ubootId(): UbootId {
    return this._uboot.id;
  }

  tune(config: UbootRadioConfig): _UbootRadio<TState> {
    this._config = {
      ...this._config,
      ...config,
    };
    return this;
  }

  send<TMessage>(
    message: TMessage,
    forUbootId?: UbootId | UbootId[],
  ): Promise<UbootRadioResult<TMessage>> {
    if (forUbootId !== undefined) {
      return this._ocean.send(this.channelId, this._uboot.id, message, forUbootId);
    } else {
      // without the forUbootId parameter: it's a broadcast
      return this._ocean.broadcast(this.channelId, this._uboot.id, message);
    }
  }

  receive<TMessage>(receiver: UbootMessageReceiver<TMessage>): UbootChannelSubscription {
    const receiverWithMiddleware = this._ocean.mwm._messageReceiver(receiver);

    this._receiver.push(receiverWithMiddleware);
    this._ocean.attachUbootToChannel(this.ubootId, this.channelId);

    const cleanup: SubscriptionCleanupFunction = () => {
      const i = this._receiver.indexOf(receiverWithMiddleware);
      if (i > -1) {
        this._receiver.splice(i, 1); // delete it from the receiver
        if (this._receiver.length === 0 && this._reducer.length === 0) {
          // delete it from the ocean if there are no receiver and reducer
          this._ocean.detechUBootFromChannel(this.ubootId, this.channelId);
        }
      }
    };

    const subscription = this._ocean.mwm._channelSubscription(
      new _UbootChannelSubscription('receiver', this.ubootId, this.channelId, cleanup),
    );
    this._uboot.attachSubscription(subscription);

    return subscription;
  }

  mutate<TMessage>(reducer: UbootReducer<TState, TMessage>): UbootChannelSubscription {
    const reducerWithMiddleware = this._ocean.mwm._reducer(reducer);
    this._reducer.push(reducerWithMiddleware);

    this._ocean.attachUbootToChannel(this.ubootId, this.channelId);

    const cleanup: SubscriptionCleanupFunction = () => {
      const i = this._reducer.indexOf(reducerWithMiddleware);
      if (i > -1) {
        this._reducer.splice(i, 1); // delete it from the reducer
        if (this._receiver.length === 0 && this._reducer.length === 0) {
          // delete it from the ocean if there are no receiver and reducer
          this._ocean.detechUBootFromChannel(this.ubootId, this.channelId);
        }
      }
    };

    const subscription = this._ocean.mwm._channelSubscription(
      new _UbootChannelSubscription('mutator', this.ubootId, this.channelId, cleanup),
    );
    this._uboot.attachSubscription(subscription);

    return subscription;
  }

  applyReceiver<TMessage>(message: TMessage, fromUboot: Uboot): void {
    this._receiver.forEach((receiver) => receiver(this._uboot, fromUboot, message)); // may throw an exception
  }

  applyReducer<TMessage>(message: TMessage): void {
    // TODO: add fromUboot as parameter?
    this._reducer.forEach((reducer) => this._uboot.applyReducer(reducer, message)); // may throw an exception
  }

  apply<TMessage>(message: TMessage, fromUboot: Uboot): void {
    // may throw exceptions
    // TODO: use the config?
    this.applyReceiver(message, fromUboot);
    this.applyReducer(message);
  }
}

export function createOcean(...middleware: UbootMiddleware[]): Ocean {
  const mwm = new UbootMiddlewareManager(middleware);
  return mwm._ocean(new _Ocean(mwm));
}

class NoopUbootMiddlewareFactory implements UbootMiddleware {
  _uboot<TState>(uboot: _Uboot<TState>): _Uboot<TState> {
    return uboot;
  }
  _channelSubscription(subscription: _UbootChannelSubscription): _UbootChannelSubscription {
    return subscription;
  }
  _messageReceiver<TMessage>(
    messageReceiver: UbootMessageReceiver<TMessage>,
  ): UbootMessageReceiver<TMessage> {
    return messageReceiver;
  }
  _reducer<TState, TMessage>(
    reducer: UbootReducer<TState, TMessage>,
  ): UbootReducer<TState, TMessage> {
    return reducer;
  }
  _radio<TState>(radio: _UbootRadio<TState>): _UbootRadio<TState> {
    return radio;
  }
  _ocean(ocean: _Ocean): _Ocean {
    return ocean;
  }
}

class UbootMiddlewareManager {
  private readonly _middleware: UbootMiddleware[] = [new NoopUbootMiddlewareFactory()];

  constructor(middleware: UbootMiddleware[] = []) {
    this._middleware.push(...middleware);
  }

  _uboot<TState>(uboot: _Uboot<TState>): _Uboot<TState> {
    let result: Uboot<TState> = uboot;
    for (let currMiddleware of this._middleware) {
      result = currMiddleware._uboot<TState>(result);
    }
    return result as _Uboot<TState>;
  }

  _channelSubscription(subscription: _UbootChannelSubscription): _UbootChannelSubscription {
    let result: UbootChannelSubscription = subscription;
    for (let currMiddleware of this._middleware) {
      result = currMiddleware._channelSubscription(subscription);
    }
    return result as _UbootChannelSubscription;
  }

  _messageReceiver<TMessage>(
    messageReceiver: UbootMessageReceiver<TMessage>,
  ): UbootMessageReceiver<TMessage> {
    let result = messageReceiver;
    for (let currMiddleware of this._middleware) {
      result = currMiddleware._messageReceiver(messageReceiver);
    }
    return result;
  }

  _reducer<TState, TMessage>(
    reducer: UbootReducer<TState, TMessage>,
  ): UbootReducer<TState, TMessage> {
    let result = reducer;
    for (let currMiddleware of this._middleware) {
      result = currMiddleware._reducer<TState, TMessage>(result);
    }
    return result as UbootReducer<TState, TMessage>;
  }

  _radio<TState>(radio: _UbootRadio<TState>): _UbootRadio<TState> {
    let result: UbootRadio = radio;
    for (let currMiddleware of this._middleware) {
      result = currMiddleware._radio(radio);
    }
    return result as _UbootRadio<TState>;
  }

  _ocean(ocean: _Ocean): _Ocean {
    let result: Ocean = ocean;
    for (let currMiddleware of this._middleware) {
      result = currMiddleware._ocean(ocean);
    }
    return result as _Ocean;
  }
}
