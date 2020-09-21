import 'jest';
import { createOcean, Uboot, Ocean } from './Uboot';

describe('Basic Uboot functionality', () => {
  interface UbootCounterState {
    counter: number;
  }

  let ocean: Ocean;
  let fooUboot: Uboot<UbootCounterState>;
  let barUboot: Uboot<UbootCounterState>;

  beforeEach(() => {
    ocean = createOcean();
    fooUboot = ocean.uboot('foo', { counter: 0 });
    barUboot = ocean.uboot('bar', { counter: 0 });
  });

  test('Uboot creation', () => {
    expect(fooUboot).toBeDefined();
    expect(fooUboot.id).toBe('foo');

    expect(barUboot).toBeDefined();
    expect(barUboot.id).toBe('bar');
  });

  test('Radio creation', () => {
    const fooRadio_x = fooUboot.radio('x');
    expect(fooRadio_x).toBeDefined();
    expect(fooRadio_x.channelId).toBe('x');
    expect(fooRadio_x.ubootId).toBe('foo');

    const fooRadio_y = fooUboot.radio('y');
    expect(fooRadio_y).toBeDefined();
    expect(fooRadio_y.channelId).toBe('y');
    expect(fooRadio_y.ubootId).toBe('foo');

    expect(fooRadio_x).not.toBe(fooRadio_y);

    const barRadio_y = barUboot.radio('y');
    expect(barRadio_y).toBeDefined();
    expect(barRadio_y.channelId).toBe('y');
    expect(barRadio_y.ubootId).toBe('bar');

    expect(fooRadio_y).not.toBe(barRadio_y);
  });

  test('Direct sending, one receiver', async (done) => {
    let testCases = 0;

    const subscription = fooUboot
      .radio('x')
      .receive<string>((me: Uboot, sender: Uboot, msg: string) => {
        expect(me).toBe(fooUboot);
        expect(sender).toBe(barUboot);
        expect(msg).toBe('hello');

        testCases += 1;
        if (testCases === 2) {
          done();
        }
      });

    expect(subscription.open).toBeTruthy();
    expect(subscription.type).toBe('receiver');

    const delivered = await barUboot.radio('x').send<string>('hello', 'foo');
    expect(delivered.received).toEqual('hello');
    expect(delivered.receiver).toHaveLength(1);
    expect(delivered.receiver).toContainEqual('foo');
    expect(delivered.error).toBeUndefined();

    testCases += 1;
    if (testCases === 2) {
      done();
    }
  });

  test('Direct sending, multiple receiver', async () => {
    const zooUboot = ocean.uboot('zoo', {});
    expect(zooUboot).toBeDefined();
    expect(zooUboot.id).toBe('zoo');

    const dontReceiveUboot = ocean.uboot('dontreceive', {});
    expect(dontReceiveUboot).toBeDefined();
    expect(dontReceiveUboot.id).toBe('dontreceive');

    let fooReceived = false;
    let barReceived = false;
    let dontreceiveReceived = false;

    fooUboot.radio('x').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(fooUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hello');

      fooReceived = true;
    });

    barUboot.radio('x').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(barUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hello');

      barReceived = true;
    });

    dontReceiveUboot.radio('x').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      // shouldn't happen
      dontreceiveReceived = true;
    });

    const delivered = await zooUboot.radio('x').send('hello', ['foo', 'bar', 'doesnotexist']);

    expect(fooReceived && barReceived).toBeTruthy();
    expect(dontreceiveReceived).toBeFalsy();

    expect(delivered.received).toEqual('hello');
    expect(delivered.receiver).toHaveLength(2);
    expect(delivered.receiver).toContainEqual('foo');
    expect(delivered.receiver).toContainEqual('bar');

    expect(delivered.error).toBeUndefined();

    return delivered;
  });

  test('Broadcast', async () => {
    const zooUboot = ocean.uboot('zoo', {});
    expect(zooUboot).toBeDefined();
    expect(zooUboot.id).toBe('zoo');

    let fooReceived = false;
    let barReceived = false;
    let zooReceived = false;

    fooUboot.radio('broadcast').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(fooUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hey broadcast');
      fooReceived = true;
    });

    barUboot.radio('broadcast').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(barUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hey broadcast');
      barReceived = true;
    });

    zooUboot.radio('broadcast').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(zooUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hey broadcast');
      zooReceived = true;
    });

    const delivered = await zooUboot.radio('broadcast').send<string>('hey broadcast');
    expect(fooReceived && barReceived && zooReceived).toBeTruthy();
    expect(delivered.received).toEqual('hey broadcast');
    expect(delivered.receiver).toHaveLength(3);
    expect(delivered.receiver).toContainEqual('foo');
    expect(delivered.receiver).toContainEqual('bar');
    expect(delivered.receiver).toContainEqual('zoo');

    expect(delivered.error).toBeUndefined();

    return delivered;
  });

  test('Subscription types', () => {
    const subAct = fooUboot.radio('x').receive<string>(() => {});
    expect(subAct.type).toBe('receiver');

    const subMut = fooUboot.radio('x').mutate<string>((state) => state);
    expect(subMut.type).toBe('mutator');
  });

  test('Uboot sinking', async () => {
    const zooUboot = ocean.uboot('zoo', {});
    expect(zooUboot).toBeDefined();
    expect(zooUboot.id).toBe('zoo');

    const sub1 = zooUboot.radio('broadcast').receive<string>(() => {});
    expect(sub1.open).toBe(true);

    let delivered = await fooUboot.radio('broadcast').send<string>('xyz');
    expect(delivered.received).toBe('xyz');
    expect(delivered.receiver).toHaveLength(1);
    expect(delivered.receiver).toContainEqual('zoo');
    expect(delivered.error).toBeUndefined();

    const sub2 = zooUboot.radio('foo').receive<string>(() => {});
    expect(sub2.open).toBe(true);

    sub2.unsubscribe();
    expect(sub1.open).toBe(true);
    expect(sub2.open).toBe(false);

    delivered = await fooUboot.radio('foo').send<string>('xyz');
    expect(delivered.received).toEqual('xyz');
    expect(delivered.receiver).toHaveLength(0);
    expect(delivered.error).toBeUndefined();

    delivered = await fooUboot.radio('broadcast').send<string>('xyz');
    expect(delivered.received).toEqual('xyz');
    expect(delivered.receiver).toHaveLength(1);
    expect(delivered.receiver).toContainEqual('zoo');
    expect(delivered.error).toBeUndefined();

    ocean.sink('zoo');
    expect(sub1.open).toBe(false);
    expect(sub2.open).toBe(false);

    delivered = await fooUboot.radio('foo').send<string>('xyz');
    expect(delivered.received).toEqual('xyz');
    expect(delivered.receiver).toHaveLength(0);
    expect(delivered.error).toBeUndefined();

    delivered = await fooUboot.radio('broadcast').send<string>('xyz');
    expect(delivered.received).toEqual('xyz');
    expect(delivered.receiver).toHaveLength(0);
    expect(delivered.error).toBeUndefined();
  });

  test('Basic reducer functionality', async () => {
    const zooUboot = ocean.uboot<UbootCounterState>('zoo', { counter: 0 });
    expect(zooUboot.state()).toStrictEqual({ counter: 0 });

    let first = true;

    const sub = zooUboot.radio('x').mutate<number>((state, message) => {
      if (first) {
        // this is not a pure function as expected, but fine for test
        expect(zooUboot.state()).toStrictEqual({ counter: 0 }); // first run
        expect(state).toStrictEqual({ counter: 0 });
        first = false;
      }

      return {
        ...state,
        counter: state.counter + message,
      };
    });

    expect(sub.open).toBeTruthy();

    let result = await fooUboot.radio('x').send(2);
    expect(result.received).toBe(2);
    expect(result.receiver).toHaveLength(1);
    expect(result.receiver).toContain('zoo');
    expect(result.error).toBeUndefined();

    expect(zooUboot.state()).toStrictEqual({ counter: 2 });

    result = await barUboot.radio('x').send(3);
    expect(result.received).toBe(3);
    expect(result.receiver).toHaveLength(1);
    expect(result.receiver).toContain('zoo');
    expect(result.error).toBeUndefined();

    expect(zooUboot.state()).toStrictEqual({ counter: 5 });

    return true;
  });

  test('Reducer unsubscribe', async () => {
    const sub = fooUboot.radio('x').mutate<number>((state, message) => {
      return {
        ...state,
        counter: state.counter + message,
      };
    });

    let result = await barUboot.radio('x').send(2);
    expect(result.received).toBe(2);
    expect(result.receiver).toHaveLength(1);
    expect(result.receiver).toContain('foo');
    expect(result.error).toBeUndefined();

    sub.unsubscribe();

    result = await barUboot.radio('x').send(2);
    expect(result.received).toBe(2);
    expect(result.receiver).toHaveLength(0);
    expect(result.receiver).not.toContain(fooUboot);
    expect(result.error).toBeUndefined();

    expect(fooUboot.state()).toStrictEqual({ counter: 2 });
  });

  test('Broadcast - Expect errors', async () => {
    const zooUboot = ocean.uboot('zoo', {});
    expect(zooUboot).toBeDefined();
    expect(zooUboot.id).toBe('zoo');

    let fooReceived = false;
    let barReceived = false;
    let zooReceived = false;

    fooUboot.radio('broadcast').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(fooUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hey broadcast');
      fooReceived = true;
    });

    barUboot.radio('broadcast').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(barUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hey broadcast');
      barReceived = true;
      throw 'A generic error';
    });

    zooUboot.radio('broadcast').receive<string>((me: Uboot, sender: Uboot, msg: string) => {
      expect(me).toBe(zooUboot);
      expect(sender).toBe(zooUboot);
      expect(msg).toBe('hey broadcast');
      zooReceived = true;
    });

    const delivered = await zooUboot.radio('broadcast').send('hey broadcast');

    expect(delivered.received).toEqual('hey broadcast');
    expect(fooReceived && barReceived && zooReceived).toBeTruthy();

    // success
    expect(delivered.receiver).toHaveLength(2);
    expect(delivered.receiver).toContainEqual('foo');
    expect(delivered.receiver).toContainEqual('zoo');

    // error
    expect(delivered.error).toBeDefined();
    expect(delivered.error).toMatchObject({ bar: 'A generic error' });

    return delivered;
  });
});
