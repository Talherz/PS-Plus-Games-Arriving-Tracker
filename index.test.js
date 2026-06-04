const { formatListText } = require('./index.js');

describe('formatListText', () => {
  it('returns a fallback message when given an empty array', () => {
    expect(formatListText([])).toBe("> *None detected or formatting changed.*\n");
  });

  it('formats games correctly when no pipes are present', () => {
    const games = ["God of War", "Spider-Man"];
    const expected = "1. **God of War**\n2. **Spider-Man**\n";
    expect(formatListText(games)).toBe(expected);
  });

  it('formats games correctly when pipes separate title and console tags', () => {
    const games = ["God of War | PS4, PS5", "Spider-Man | PS4"];
    const expected = "1. **God of War** | PS4, PS5\n2. **Spider-Man** | PS4\n";
    expect(formatListText(games)).toBe(expected);
  });

  it('handles a mix of games with and without pipes', () => {
    const games = ["God of War | PS4, PS5", "Bloodborne", "Spider-Man | PS4"];
    const expected = "1. **God of War** | PS4, PS5\n2. **Bloodborne**\n3. **Spider-Man** | PS4\n";
    expect(formatListText(games)).toBe(expected);
  });

  it('handles spaces around the pipe correctly', () => {
    const games = ["A|B", "C | D", "E| F"];
    const expected = "1. **A** |B\n2. **C** | D\n3. **E** | F\n";
    expect(formatListText(games)).toBe(expected);
  });
});
