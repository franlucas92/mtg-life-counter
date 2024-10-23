// pages/index.js
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export default function Home()
{
  const [socket, setSocket] = useState(null);
  const [life, setLife] = useState(40);
  const [gameId, setGameId] = useState('');

  useEffect(() =>
  {
    const socketIo = io();

    setSocket(socketIo);

    socketIo.on('updateLife', (lifeData) =>
    {
      setLife(lifeData);
    });

    return () =>
    {
      socketIo.disconnect();
    };
  }, []);

  const handleJoinGame = () =>
  {
    socket.emit('joinGame', gameId);
  };

  const handleLifeChange = (delta) =>
  {
    const newLife = life + delta;
    setLife(newLife);
    socket.emit('updateLife', { gameId, lifeData: newLife });
  };

  return (
    <div>
      <input
        type="text"
        placeholder="ID de la partida"
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
      />
      <button onClick={handleJoinGame}>Unirse a la partida</button>
      <h1>Vida: {life}</h1>
      <button onClick={() => handleLifeChange(1)}>+1</button>
      <button onClick={() => handleLifeChange(-1)}>-1</button>
    </div>
  );
}
