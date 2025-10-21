import { describe, it, expect } from "vitest";

import { sanitize } from "../../src/utils/sanitize.js";

describe("sanitize", () => {
  it("should return empty string for non-string input", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(undefined)).toBe("");
    expect(sanitize(123)).toBe("");
    expect(sanitize({})).toBe("");
    expect(sanitize([])).toBe("");
  });

  it("should strip all HTML tags", () => {
    expect(sanitize("<script>alert('xss')</script>")).toBe("");
    expect(sanitize("<div>Hello</div>")).toBe("Hello");
    expect(sanitize("<b>Bold</b> text")).toBe("Bold text");
    expect(sanitize("<a href='http://evil.com'>Click</a>")).toBe("Click");
  });

  it("should strip all HTML attributes", () => {
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe("");
    expect(sanitize('<div class="test">Content</div>')).toBe("Content");
    expect(sanitize('<span style="color:red">Text</span>')).toBe("Text");
  });

  it("should prevent XSS attacks", () => {
    // Test script tag injection
    expect(sanitize("<script>alert('XSS')</script>")).toBe("");

    // Test image with onerror
    const imgResult = sanitize("<img src=x onerror=alert('XSS')>");
    expect(imgResult).not.toContain("onerror");
    expect(imgResult).not.toContain("alert");

    // Test SVG with onload
    const svgResult = sanitize("<svg/onload=alert('XSS')>");
    expect(svgResult).not.toContain("onload");

    // Test iframe with javascript URL
    const iframeResult = sanitize("<iframe src='javascript:alert(1)'></iframe>");
    expect(iframeResult).not.toContain("iframe");
    expect(iframeResult).not.toContain("javascript");

    // Test body with onload
    const bodyResult = sanitize("<body onload=alert('XSS')>");
    expect(bodyResult).not.toContain("onload");
  });

  it("should handle plain text without modification", () => {
    expect(sanitize("Hello World")).toBe("Hello World");
    expect(sanitize("Test 123")).toBe("Test 123");
    expect(sanitize("Special chars: & < > \" '")).toBe(
      "Special chars: &amp; &lt; &gt; \" '",
    );
  });

  it("should handle empty strings", () => {
    expect(sanitize("")).toBe("");
    expect(sanitize("   ")).toBe("   ");
  });

  it("should handle nested HTML tags", () => {
    expect(sanitize("<div><span><b>Deep</b></span></div>")).toBe("Deep");
    expect(sanitize("<ul><li><a>Link</a></li></ul>")).toBe("Link");
  });

  it("should strip event handlers", () => {
    expect(sanitize('<button onclick="alert(1)">Click</button>')).toBe("Click");
    expect(sanitize('<div onmouseover="steal()">Hover</div>')).toBe("Hover");
  });
});
