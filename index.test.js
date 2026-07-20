const { decodeHtmlEntities } = require("./index");

describe("decodeHtmlEntities", () => {
  it("should replace &#8211; with a hyphen", () => {
    expect(decodeHtmlEntities("word&#8211;word")).toBe("word-word");
  });

  it("should replace &#8212; with a hyphen", () => {
    expect(decodeHtmlEntities("word&#8212;word")).toBe("word-word");
  });

  it("should replace &#8217; with a single quote", () => {
    expect(decodeHtmlEntities("it&#8217;s")).toBe("it's");
  });

  it("should replace &amp; with an ampersand", () => {
    expect(decodeHtmlEntities("black &amp; white")).toBe("black & white");
  });

  it("should replace &nbsp; with a space", () => {
    expect(decodeHtmlEntities("word&nbsp;word")).toBe("word word");
  });

  it("should handle multiple entities in a single string", () => {
    expect(
      decodeHtmlEntities(
        "it&#8217;s black &amp; white&#8212;mostly&nbsp;black",
      ),
    ).toBe("it's black & white-mostly black");
  });

  it("should return the same string if no entities are present", () => {
    expect(decodeHtmlEntities("normal text")).toBe("normal text");
  });

  it("should handle an empty string", () => {
    expect(decodeHtmlEntities("")).toBe("");
  });

  it("should handle non-string inputs by converting them to a string", () => {
    expect(decodeHtmlEntities(123)).toBe("123");
    expect(decodeHtmlEntities(null)).toBe("null");
    expect(decodeHtmlEntities(undefined)).toBe("undefined");
  });
});
