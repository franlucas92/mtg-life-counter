// pages/_app.js

"use client";

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import styles from './styles.css';
import useWakeLock from '../useWakeLock';

let socket;

export default function Home()
{
    const [gameState, setGameState] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [numPlayers, setNumPlayers] = useState(2);
    const [playerData, setPlayerData] = useState(null);
    const [life, setLife] = useState(40);
    const [errorMessage, setErrorMessage] = useState('');
    const [playerId, setPlayerId] = useState('');
    // Añade estados para el comandante y resultados de búsqueda
    const [commanderName, setCommanderName] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedCommander, setSelectedCommander] = useState(null);


    // Estados para los contadores temporales
    const [temporaryLifeChanges, setTemporaryLifeChanges] = useState({});
    const [temporaryCommanderDamageChanges, setTemporaryCommanderDamageChanges] = useState({});
    const [showCommanderDamage, setShowCommanderDamage] = useState(false);

    // Refs y variables para temporizadores
    const lifeChangeTimers = useRef({});
    const commanderDamageTimers = useRef({});
    const commanderDamageRef = useRef(null);

    useEffect(() =>
    {
        const handleClickOutside = (event) =>
        {
            console.log('handleClickOutside', commanderDamageRef.current);
            if(
                commanderDamageRef.current &&
                !commanderDamageRef.current.contains(event.target)
            )
            {
                setShowCommanderDamage(false);
            }
        };

        if(showCommanderDamage)
        {
            document.addEventListener('mousedown', handleClickOutside);
        } else
        {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () =>
        {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCommanderDamage]);

    useWakeLock();
    useEffect(() =>
    {
        let storedPlayerId = localStorage.getItem('playerId');
        if(!storedPlayerId)
        {
            storedPlayerId = generatePlayerId();
            localStorage.setItem('playerId', storedPlayerId);
        }
        setPlayerId(storedPlayerId);

        // Recuperar el nombre del jugador
        const storedPlayerName = localStorage.getItem('playerName');
        if(storedPlayerName)
        {
            setPlayerName(storedPlayerName);
        }

        // Recuperar el comandante seleccionado
        const storedCommander = localStorage.getItem('selectedCommander');
        if(storedCommander)
        {
            const commander = JSON.parse(storedCommander);
            setSelectedCommander(commander);
            setCommanderName(commander.name);
        }

        socketInitializer();
        const pingInterval = setInterval(() =>
        {
            if(socket && socket.connected)
            {
                socket.emit('ping');
            }
        }, 10000); // 10 segundos

        return () =>
        {
            clearInterval(pingInterval);
        };
    }, []);
    const generatePlayerId = () =>
    {
        return 'player-' + Math.random().toString(36).substr(2, 9);
    };

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
                const updatedPlayerData = state.players.find((p) => p.playerId === playerId);
                if(updatedPlayerData)
                {
                    setPlayerData(updatedPlayerData);
                    setLife(updatedPlayerData.life);
                } else
                {
                    // Si el jugador no está en la partida pero tiene nombre y comandante, intenta unirse
                    if(playerName && selectedCommander)
                    {
                        socket.emit('joinGame', { playerName, playerId, commander: selectedCommander });
                    }
                }
            } else
            {
                // El gameState es null, la partida ha sido eliminada
                // Resetear el estado del cliente
                setPlayerData(null);
                setLife(40); // Valor inicial
                // Opcional: Redirigir al usuario a la pantalla inicial

            }
        });


        socket.on('pong', () => {
            console.log('Pong recibido del servidor');
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

    const handlePlayerNameChange = (e) =>
    {
        const value = e.target.value;
        setPlayerName(value);
        localStorage.setItem('playerName', value); // Almacenar en localStorage
    };


    const handleCreateGame = () =>
    {
        socket.emit('createGame', numPlayers);
    };

    // En el estado
    const [searchTimeout, setSearchTimeout] = useState(null);

    // En la función de manejo del cambio en el input
    const handleCommanderNameChange = (e) =>
    {
        const value = e.target.value;
        setCommanderName(value);

        // Limpiar el timeout anterior
        if(searchTimeout)
        {
            clearTimeout(searchTimeout);
        }

        // Establecer un nuevo timeout para esperar antes de buscar
        const timeout = setTimeout(() =>
        {
            if(value.trim() !== '')
            {
                socket.emit('searchCard', value.trim(), (response) =>
                {
                    if(response.error)
                    {
                        setErrorMessage(response.error);
                    } else
                    {
                        setSearchResults(response.cards);
                    }
                });
            } else
            {
                setSearchResults([]);
            }
        }, 300); // Esperar 300ms después de que el usuario deja de escribir

        setSearchTimeout(timeout);
    };




    // Al unirse a la partida, enviar el comandante seleccionado
    const handleJoinGame = () =>
    {
        if(playerName.trim() !== '' && selectedCommander)
        {
            socket.emit('joinGame', { playerName, playerId, commander: selectedCommander });
        } else
        {
            setErrorMessage('Debes ingresar tu nombre y seleccionar un comandante.');
        }
    };

    const handleLifeChange = (playerId, delta) =>
    {
        socket.emit('updateLife', { playerId, delta });
        // Actualizar el contador temporal de vida modificada
        setTemporaryLifeChanges(prev =>
        {
            const currentChange = prev[playerId] || 0;
            return { ...prev, [playerId]: currentChange + delta };
        });

        // Limpiar el temporizador anterior si existe
        if(lifeChangeTimers.current[playerId])
        {
            clearTimeout(lifeChangeTimers.current[playerId]);
        }

        // Iniciar un nuevo temporizador para resetear el contador después de 3 segundos
        lifeChangeTimers.current[playerId] = setTimeout(() =>
        {
            setTemporaryLifeChanges(prev =>
            {
                const newChanges = { ...prev };
                delete newChanges[playerId];
                return newChanges;
            });
            delete lifeChangeTimers.current[playerId];
        }, 3000);
    };


    const handleCommanderDamageChange = (fromPlayerId, toPlayerId, delta) =>
    {
        const player = gameState.players.find((p) => p.id === toPlayerId);
        if(player)
        {
            const currentDamage = player.commanderDamage[fromPlayerId] || 0;
            const newDamage = currentDamage + delta;
            if(newDamage >= 0)
            {
                socket.emit('updateCommanderDamage', {
                    fromPlayerId: fromPlayerId,
                    toPlayerId: toPlayerId,
                    damage: newDamage,
                });

                // Actualizar el contador temporal
                const key = `${toPlayerId}_${fromPlayerId}`;
                setTemporaryCommanderDamageChanges(prev =>
                {
                    const currentChange = prev[key] || 0;
                    return { ...prev, [key]: currentChange + delta };
                });

                // Limpiar el temporizador anterior si existe
                if(commanderDamageTimers[key])
                {
                    clearTimeout(commanderDamageTimers[key]);
                }

                // Iniciar un nuevo temporizador para resetear el contador después de 3 segundos
                commanderDamageTimers[key] = setTimeout(() =>
                {
                    setTemporaryCommanderDamageChanges(prev =>
                    {
                        const newChanges = { ...prev };
                        delete newChanges[key];
                        return newChanges;
                    });
                    delete commanderDamageTimers[key];
                }, 3000);
            }
        }
    };



    const handleResetGame = () =>
    {
        socket.emit('resetGame');
    };

    if(!gameState)
    {
        // Mostrar la sección para crear una partida
        return (
            <div className="container">
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
                {errorMessage && <p className="error">{errorMessage}</p>}
            </div>
        );
    }

    if(!playerData)
    {
        // Mostrar la sección para unirse a la partida
        return (
            <div className="container">
                <h1>Unirse a la partida</h1>
                <input
                    type="text"
                    placeholder="Tu nombre"
                    value={playerName}
                    onChange={handlePlayerNameChange}
                />
                <div>
                    <input
                        type="text"
                        value={commanderName}
                        onChange={handleCommanderNameChange}
                        placeholder="Nombre del comandante"
                        className="commanderSearchInput"
                    />
                </div>
                {searchResults.length > 0 && (
                    <div className="searchResults">
                        {searchResults.map((card) => (
                            card.image && (
                                <div
                                    key={card.id}
                                    className="searchResultItem"
                                    onClick={() =>
                                    {
                                        setSelectedCommander(card);
                                        setCommanderName(card.name);
                                        setSearchResults([]); // Opcional: ocultar los resultados después de seleccionar
                                        localStorage.setItem('selectedCommander', JSON.stringify(card));
                                    }}
                                >
                                    <img src={card.image} alt={card.name} className="cardThumbnail" />
                                    <span>{card.name}</span>
                                </div>
                            )
                        ))}
                    </div>
                )}
                {selectedCommander && (
                    <div className="selectedCommander">
                        <h3>Comandante seleccionado:</h3>
                        <img src={selectedCommander.image} alt={selectedCommander.name} />
                        <p>{selectedCommander.name}</p>
                    </div>
                )}

                <button onClick={handleJoinGame}>Unirse</button>
                {errorMessage && <p className="error">{errorMessage}</p>}
            </div>
        );
    }

    // Mostrar los contadores de vida
    return (
        <div className="container">
            <div className="gameContainer">
                {gameState.startingPlayer && (
                    <h2>
                        {gameState.startingPlayer === playerData.id
                            ? '¡Eres el jugador inicial!'
                            : `Jugador inicial: ${gameState.players.find((p) => p.id === gameState.startingPlayer)?.name || ''
                            }`}
                    </h2>
                )}
                <div className="playerCardsContainer">
                    {gameState.players.map((player) => (
                        <div
                            key={player.id}
                            className="playerCard"
                            style={{
                                backgroundImage: `url(${player.commanderImage})`, backgroundSize: 'cover', backgroundColor: player.color, opacity: player.isDead ? 0.5 : 1, backgroundPosition: 'center', textShadow:
                                    '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', position: 'relative'
                            }}
                        >
                            <h2>{player.name || 'Esperando...'}</h2>
                            {player.isDead && <p>Muerto</p>}
                            <h1>{player.life}</h1>

                            {/* Mostrar el contador temporal si existe */}
                            {temporaryLifeChanges[player.id] && (
                                <div className="temporaryLifeChange">
                                    {temporaryLifeChanges[player.id] > 0 ? '+' : ''}
                                    {temporaryLifeChanges[player.id]}
                                </div>
                            )}

                            {/* Controles para ajustar la vida de este jugador */}
                            <div>
                                <button onClick={() => handleLifeChange(player.id, 1)}>+1</button>
                                <button onClick={() => handleLifeChange(player.id, -1)}>-1</button>
                            </div>
                            {/* Botón para mostrar/ocultar la sección de daño de comandante */}
                            <button onClick={() => setShowCommanderDamage(true)}>
                                Mostrar Daño de Comandante
                            </button>

                            {/* Mostrar daño de comandante recibido por este jugador */}
                            {showCommanderDamage && (
                                <div className="commanderDamageSection" 
                                ref={commanderDamageRef} >
                                    <h3>Daño de comandante recibido:</h3>
                                    {gameState.players
                                        .filter((p) => p.id !== player.id)
                                        .map((opponent) =>
                                        {
                                            const damage = player.commanderDamage[opponent.id] || 0;
                                            return (
                                                <div key={opponent.id} className="commanderDamageRow">
                                                    <span>
                                                        {opponent.name}: {damage}
                                                    </span>
                                                    {/* Mostrar el contador temporal si existe */}
                                                    {temporaryCommanderDamageChanges[`${player.id}_${opponent.id}`] && (
                                                        <span className="temporaryCommanderDamageChange">
                                                            ({temporaryCommanderDamageChanges[`${player.id}_${opponent.id}`] > 0 ? '+' : ''}
                                                            {temporaryCommanderDamageChanges[`${player.id}_${opponent.id}`]})
                                                        </span>
                                                    )}
                                                    <button onClick={() => handleCommanderDamageChange(opponent.id, player.id, 1)}>
                                                        +1
                                                    </button>
                                                    <button onClick={() => handleCommanderDamageChange(opponent.id, player.id, -1)}>
                                                        -1
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    ))}

                </div>
                <button className="resetButton" onClick={handleResetGame}>
                    Reiniciar Partida
                </button>
                {errorMessage && <p className="error">{errorMessage}</p>}
            </div>
        </div>
    );
}
