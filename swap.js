import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';

const tokens = [/* ...your token data... */];

const App = () => {
  const [index, setIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setIndex(i => Math.max(0, i - 1));
    if (key.downArrow) setIndex(i => Math.min(tokens.length - 1, i + 1));
  });

  const token = tokens[index];

  return (
    <Box flexDirection="column">
      <Text color="cyan">Solana Token Tracker</Text>
      <Box>
        <Text>{`[${index + 1}/${tokens.length}] `}</Text>
        <Text color="yellow">{token.name}</Text>
        <Text> ({token.symbol})</Text>
      </Box>
      <Text>Address: {token.address}</Text>
      <Text>Price: ${token.price}</Text>
      {/* Add more info, charts, etc. */}
      <Text dimColor>Use ↑/↓ to navigate</Text>
    </Box>
  );
};

render(<App />);