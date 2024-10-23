// pages/_app.js

"use client";

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import styles from './styles.css';

let socket;

export default function Home()
{
    const [gameState, setGameState] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [numPlayers, setNumPlayers] = useState(2);
    const [playerData, setPlayerData] = useState(null);
    const [life, setLife] = useState(40);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() =>
    {
        socketInitializer();
    }, []);

    const socketInitializer = async () =>
    {
        socket = io();

        socket.on('connect', () =>
        {
            console.log('Conectado al servidor de sockets');
        });

        socket.on('gameState', (state) =>
        {
            setGameState(state);
            if(state != null)
            {
                const updatedPlayerData = state.players.find((p) => p.id === socket.id);
                if(updatedPlayerData)
                {
                    setPlayerData(updatedPlayerData);
                    setLife(updatedPlayerData.life);
                }
            }
        });

        socket.on('playerData', (data) =>
        {
            setPlayerData(data);
            setLife(data.life);
        });

        socket.on('errorMessage', (message) =>
        {
            setErrorMessage(message);
            setTimeout(() => setErrorMessage(''), 3000);
        });
    };

    const handleCreateGame = () =>
    {
        socket.emit('createGame', numPlayers);
    };

    const handleJoinGame = () =>
    {
        if(playerName.trim() !== '')
        {
            socket.emit('joinGame', playerName);
        }
    };

    const handleLifeChange = (delta) =>
    {
        const newLife = life + delta;
        setLife(newLife);
        socket.emit('updateLife', newLife);
    };

    const handleCommanderDamageChange = (fromPlayerId, delta) =>
    {
        /*if(!playerData.isDead)
        {*/
            const currentDamage = playerData.commanderDamage[fromPlayerId] || 0;
            const newDamage = currentDamage + delta;
            if(newDamage >= 0)
            {
                socket.emit('updateCommanderDamage', {
                    fromPlayerId: fromPlayerId,
                    toPlayerId: playerData.id,
                    damage: newDamage,
                });
            }
       // }
    };


    const handleResetGame = () =>
    {
        socket.emit('resetGame');
    };

    if(!gameState)
    {
        // Mostrar la sección para crear una partida
        return (
            <div className={styles.container}>
                <h1>Crear una nueva partida</h1>
                <label>
                    Número de jugadores (2-6):
                    <input
                        type="number"
                        min="2"
                        max="6"
                        value={numPlayers}
                        onChange={(e) => setNumPlayers(Number(e.target.value))}
                    />
                </label>
                <button onClick={handleCreateGame}>Crear Partida</button>
                {errorMessage && <p className={styles.error}>{errorMessage}</p>}
            </div>
        );
    }

    if(!playerData)
    {
        // Mostrar la sección para unirse a la partida
        return (
            <div className={styles.container}>
                <h1>Unirse a la partida</h1>
                <input
                    type="text"
                    placeholder="Tu nombre"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                />
                <button onClick={handleJoinGame}>Unirse</button>
                {errorMessage && <p className={styles.error}>{errorMessage}</p>}
            </div>
        );
    }

    // Mostrar los contadores de vida
    return (
        <div className={styles.gameContainer}>
            {gameState.startingPlayer && (
                <h2>
                    {gameState.startingPlayer === playerData.id
                        ? '¡Eres el jugador inicial!'
                        : `Jugador inicial: ${gameState.players.find((p) => p.id === gameState.startingPlayer)?.name || ''
                        }`}
                </h2>
            )}
            <div className={styles.gridContainer}>
                {gameState.players.map((player) => (
                    <div
                        key={player.id}
                        className={styles.playerCard}
                        style={{ backgroundColor: player.color, opacity: player.isDead ? 0.5 : 1 }}
                    >
                        <h2>{player.name || 'Esperando...'}</h2>
                        {player.isDead && <p>Muerto</p>}
                        <h1>{player.life}</h1>
                        {player.id === playerData.id  && (
                            <div>
                                <button onClick={() => handleLifeChange(1)}>+1</button>
                                <button onClick={() => handleLifeChange(-1)}>-1</button>
                            </div>
                        )}
                        {/* Mostrar daño de comandante recibido de otros jugadores */}
                        {player.id === playerData.id  && (
                            <div className={styles.commanderDamageSection}>
                                <h3>Daño de comandante recibido:</h3>
                                {gameState.players
                                    .filter((p) => p.id !== player.id)
                                    .map((opponent) =>
                                    {
                                        const damage = player.commanderDamage[opponent.id] || 0;
                                        return (
                                            <div key={opponent.id} className={styles.commanderDamageRow}>
                                                <span>{opponent.name}: {damage}</span>
                                                <button onClick={() => handleCommanderDamageChange(opponent.id, 1)}>+1</button>
                                                <button onClick={() => handleCommanderDamageChange(opponent.id, -1)}>-1</button>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button className={styles.resetButton} onClick={handleResetGame}>
                Reiniciar Partida
            </button>
            {errorMessage && <p className={styles.error}>{errorMessage}</p>}
        </div>
    );
}
