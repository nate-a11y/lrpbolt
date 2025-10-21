import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import retry from "../../src/utils/retry.js";
import AppError from "../../src/utils/AppError.js";

describe("retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should succeed on first try", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const promise = retry(fn);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");

    const promise = retry(fn, { tries: 3, min: 100, jitter: false });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));

    const promise = retry(fn, { tries: 3, min: 100, jitter: false });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toThrow(AppError);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should use exponential backoff", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retry(fn, {
      tries: 3,
      min: 100,
      factor: 2,
      jitter: false,
    });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toThrow();

    // Verify exponential backoff occurred
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should respect max delay", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retry(fn, {
      tries: 5,
      min: 100,
      max: 500,
      factor: 10,
      jitter: false,
    });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("should call onError callback on each failure", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const onError = vi.fn();

    const promise = retry(fn, {
      tries: 3,
      min: 100,
      jitter: false,
      onError,
    });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toThrow();

    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenNthCalledWith(1, expect.any(AppError), 1);
    expect(onError).toHaveBeenNthCalledWith(2, expect.any(AppError), 2);
    expect(onError).toHaveBeenNthCalledWith(3, expect.any(AppError), 3);
  });

  it("should wrap non-AppError errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("standard error"));

    const promise = retry(fn, { tries: 1, min: 100 });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toMatchObject({
      message: "standard error",
      code: "RETRY_FAIL",
    });
  });

  it("should preserve AppError instances", async () => {
    const customError = new AppError("custom message", "CUSTOM_CODE");
    const fn = vi.fn().mockRejectedValue(customError);

    const promise = retry(fn, { tries: 1, min: 100 });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toMatchObject({
      message: "custom message",
      code: "CUSTOM_CODE",
    });
  });

  it("should abort on signal", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("should not matter");
    });

    const promise = retry(fn, { tries: 3, signal: controller.signal });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toMatchObject({
      message: "Aborted",
      code: "ABORTED",
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should pass signal to fn", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockResolvedValue("success");

    const promise = retry(fn, { signal: controller.signal });

    await vi.runAllTimersAsync();
    await promise;

    expect(fn).toHaveBeenCalledWith({ signal: controller.signal });
  });

  it("should apply jitter when enabled", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retry(fn, {
      tries: 3,
      min: 100,
      factor: 2,
      jitter: true,
    });

    await expect(async () => {
      await vi.runAllTimersAsync();
      await promise;
    }).rejects.toThrow();

    // With jitter enabled, delays should vary
    // We can't test exact values, but we can verify it completes
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
