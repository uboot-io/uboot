export type UbootId = string;
export type ChannelId = string;

export interface UbootRadioResult<TMessage> {
  received: TMessage;
  receiver: UbootId[];
  // TODO: distinguish: receiver (actor) and reducer (mutator)
  error?: { [ubootId: string]: any };
}

export interface UbootRadioConfig {
  // TODO
  [key: string]: any;
}

export interface UbootRadio<TState extends {} = {}> {
  readonly ubootId: UbootId;
  readonly channelId: ChannelId;
  tune(config: UbootRadioConfig): UbootRadio;
  send<TMessage>(
    message: TMessage,
    forUbootId?: UbootId | UbootId[],
  ): Promise<UbootRadioResult<TMessage>>;

  receive<TMessage>(receiver: UbootMessageReceiver<TMessage>): UbootChannelSubscription;

  mutate<TMessage>(reducer: UbootReducer<TState, TMessage>): UbootChannelSubscription;
}

export interface UbootMessageReceiver<TMessage, TStateMe = any, TStateSender = any> {
  (me: Uboot<TStateMe>, sender: Uboot<TStateSender>, message: TMessage): void;
}

export interface UbootReducer<TState, TMessage> {
  (state: TState, message: TMessage): TState;
}

export type UbootChannelSubscriptionType = 'receiver' | 'mutator';

export interface UbootChannelSubscription {
  type: UbootChannelSubscriptionType;
  unsubscribe(): void;
  readonly open: boolean;
}

export interface Uboot<TState extends {} = {}> {
  readonly id: UbootId;

  radio(channelId: ChannelId): UbootRadio<TState>;
  state(): TState;
}

export interface Ocean {
  uboot<TState extends {} = {}>(ubootId: UbootId, initialState: TState): Uboot<TState>;
  sink(ubootId: UbootId): void;
}

export interface UbootMiddleware {
  _uboot<TState>(uboot: Uboot<TState>): Uboot<TState>;
  _channelSubscription(subscription: UbootChannelSubscription): UbootChannelSubscription;
  _messageReceiver<TMessage>(
    messageReceiver: UbootMessageReceiver<TMessage>,
  ): UbootMessageReceiver<TMessage>;
  _reducer<TState, TMessage>(
    reducer: UbootReducer<TState, TMessage>,
  ): UbootReducer<TState, TMessage>;
  _radio<TState>(radio: UbootRadio<TState>): UbootRadio<TState>;
  _ocean(ocean: Ocean): Ocean;
}
