import { InMemoryCache } from '@/shared/infrastructure/cache/in-memory-cache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = InMemoryCache.getInstance();
    cache.clear();
  });

  it('should set and get values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should check if key exists', () => {
    cache.set('key1', 'value');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('should clear all values', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should return all keys', () => {
    cache.set('x', 10);
    cache.set('y', 20);
    expect(cache.keys()).toEqual(expect.arrayContaining(['x', 'y']));
  });

  it('should be a singleton', () => {
    const instance1 = InMemoryCache.getInstance();
    const instance2 = InMemoryCache.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should handle complex objects', () => {
    const obj = { name: 'test', nested: { value: 42 } };
    cache.set('obj', obj);
    expect(cache.get<typeof obj>('obj')).toEqual(obj);
  });

  it('should expire items after TTL', () => {
    jest.useFakeTimers();
    const systemTime = Date.now();
    jest.setSystemTime(systemTime);

    cache.set('key', 'val', 5000); // 5 seconds TTL
    expect(cache.get('key')).toBe('val');

    // Advance time by 5001ms
    jest.setSystemTime(systemTime + 5001);

    expect(cache.get('key')).toBeNull();
    jest.useRealTimers();
  });

  it('should not expire items before TTL', () => {
    jest.useFakeTimers();
    const systemTime = Date.now();
    jest.setSystemTime(systemTime);

    cache.set('key', 'val', 5000);
    
    // Advance time by 4999ms
    jest.setSystemTime(systemTime + 4999);

    expect(cache.get('key')).toBe('val');
    jest.useRealTimers();
  });

  it('should evict expired items from keys and size', () => {
    jest.useFakeTimers();
    const systemTime = Date.now();
    jest.setSystemTime(systemTime);

    cache.set('key1', 'val1', 5000);
    cache.set('key2', 'val2'); // infinite

    expect(cache.size()).toBe(2);
    expect(cache.keys()).toEqual(expect.arrayContaining(['key1', 'key2']));

    // Advance time by 5001ms
    jest.setSystemTime(systemTime + 5001);

    expect(cache.size()).toBe(1);
    expect(cache.keys()).toEqual(['key2']);
    jest.useRealTimers();
  });
});
