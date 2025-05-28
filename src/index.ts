import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  Pokemon,
  PokemonAbility,
  PokemonResponse,
  PokemonSpeciesDetails,
  PokemonType,
  GenerationData,
  TypeData,
  BattlePokemon,
  BattleState,
  BattleResult,
  BattleMove,
  BattleStats
} from "./types.js";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const USER_AGENT = "pokedex-app/1.0";

// Region to generation mapping
const REGION_TO_GENERATION: Record<string, number> = {
  kanto: 1,
  johto: 2,
  hoenn: 3,
  sinnoh: 4,
  unova: 5,
  kalos: 6,
  alola: 7,
  galar: 8,
  paldea: 9,
};

// Create server instance
const server = new McpServer({
  name: "pokedex",
  version: "1.0.0",
});

// Global battle state
let currentBattle: BattleState | null = null;

// Helper function for making PokeAPI requests
async function fetchFromPokeAPI<T>(endpoint: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
  };

  try {
    const response = await fetch(`${POKEAPI_BASE_URL}${endpoint}`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making PokeAPI request:", error);
    return null;
  }
}

// Helper function to get a random item from an array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper function to get English flavor text
function getEnglishFlavorText(species: PokemonSpeciesDetails): string {
  return (
    species.flavor_text_entries
      .find((entry) => entry.language.name === "en")
      ?.flavor_text.replace(/\n/g, " ")
      .replace(/\f/g, " ") || "No description available."
  );
}

// Helper function to format Pokémon types
function formatPokemonTypes(types: PokemonType[]): string {
  return types.map((t) => capitalizeFirstLetter(t.type.name)).join(", ");
}

// Helper function to format Pokémon abilities
function formatPokemonAbilities(abilities: PokemonAbility[]): string {
  return abilities.map((a) => capitalizeFirstLetter(a.ability.name)).join(", ");
}

// Helper function to get detailed Pokémon information
async function getPokemonDetails(pokemonNameOrId: string) {
  const pokemon = await fetchFromPokeAPI<Pokemon>(
    `/pokemon/${pokemonNameOrId.toLowerCase()}`
  );
  if (!pokemon) return null;

  const species = await fetchFromPokeAPI<PokemonSpeciesDetails>(
    `/pokemon-species/${pokemon.id}`
  );
  if (!species) return null;

  return { pokemon, species };
}

// Helper function to format Pokémon response
function formatPokemonResponse(
  pokemon: Pokemon,
  species: PokemonSpeciesDetails
): PokemonResponse {
  const types = formatPokemonTypes(pokemon.types);
  const abilities = formatPokemonAbilities(pokemon.abilities);
  const flavorText = getEnglishFlavorText(species);

  const text = `
# ${capitalizeFirstLetter(pokemon.name)} (#${pokemon.id})

**Types:** ${types}
**Height:** ${pokemon.height / 10}m
**Weight:** ${pokemon.weight / 10}kg
**Abilities:** ${abilities}

**Description:** ${flavorText}
  `.trim();

  return {
    content: [
      {
        type: "text",
        text: text,
      },
    ],
  };
}

// Helper function to get a random Pokémon
async function getRandomPokemon(): Promise<PokemonResponse> {
  // There are currently around 1000+ Pokémon, but we'll limit to 1000 to be safe
  const randomId = Math.floor(Math.random() * 1000) + 1;
  const details = await getPokemonDetails(randomId.toString());

  if (!details) {
    return {
      content: [
        {
          type: "text",
          text: "Failed to retrieve a random Pokémon. Please try again.",
        },
      ],
    };
  }

  return formatPokemonResponse(details.pokemon, details.species);
}

// Helper function to get a random Pokémon from a region
async function getRandomPokemonFromRegion(
  region: string
): Promise<PokemonResponse> {
  const normalizedRegion = region.toLowerCase();
  const generation = REGION_TO_GENERATION[normalizedRegion];

  if (!generation) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown region: ${region}. Available regions are: ${Object.keys(
            REGION_TO_GENERATION
          ).join(", ")}`,
        },
      ],
    };
  }

  // Get all Pokémon from this generation
  const generationData = await fetchFromPokeAPI<GenerationData>(
    `/generation/${generation}`
  );

  if (
    !generationData ||
    !generationData.pokemon_species ||
    generationData.pokemon_species.length === 0
  ) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to retrieve Pokémon from the ${normalizedRegion} region.`,
        },
      ],
    };
  }

  // Select a random Pokémon
  const randomPokemon = getRandomItem(generationData.pokemon_species);

  // Get detailed information about this Pokémon
  const details = await getPokemonDetails(randomPokemon.name);

  if (!details) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to retrieve details for the selected Pokémon from ${normalizedRegion}.`,
        },
      ],
    };
  }

  // Add region information to the response
  const types = formatPokemonTypes(details.pokemon.types);
  const abilities = formatPokemonAbilities(details.pokemon.abilities);
  const flavorText = getEnglishFlavorText(details.species);

  return {
    content: [
      {
        type: "text",
        text: `
# Random ${capitalizeFirstLetter(
          normalizedRegion
        )} Pokémon: ${capitalizeFirstLetter(details.pokemon.name)} (#${
          details.pokemon.id
        })

**Types:** ${types}
**Height:** ${details.pokemon.height / 10}m
**Weight:** ${details.pokemon.weight / 10}kg
**Abilities:** ${abilities}

**Description:** ${flavorText}
        `.trim(),
      },
    ],
  };
}

// Helper function to get a random Pokémon of a specific type
async function getRandomPokemonByType(type: string): Promise<PokemonResponse> {
  const normalizedType = type.toLowerCase();

  // Get all Pokémon of this type
  const typeData = await fetchFromPokeAPI<TypeData>(`/type/${normalizedType}`);

  if (!typeData || !typeData.pokemon || typeData.pokemon.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown type: ${type} or no Pokémon found of this type.`,
        },
      ],
    };
  }

  // Select a random Pokémon
  const randomPokemon = getRandomItem(typeData.pokemon);

  // Get detailed information about this Pokémon
  const details = await getPokemonDetails(randomPokemon.pokemon.name);

  if (!details) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to retrieve details for the selected ${normalizedType} Pokémon.`,
        },
      ],
    };
  }

  // Add type information to the response
  const types = formatPokemonTypes(details.pokemon.types);
  const abilities = formatPokemonAbilities(details.pokemon.abilities);
  const flavorText = getEnglishFlavorText(details.species);

  return {
    content: [
      {
        type: "text",
        text: `
# Random ${capitalizeFirstLetter(
          normalizedType
        )} Pokémon: ${capitalizeFirstLetter(details.pokemon.name)} (#${
          details.pokemon.id
        })

**Types:** ${types}
**Height:** ${details.pokemon.height / 10}m
**Weight:** ${details.pokemon.weight / 10}kg
**Abilities:** ${abilities}

**Description:** ${flavorText}
        `.trim(),
      },
    ],
  };
}

// Add this helper function after getPokemonDetails
async function getPokemonById(id: number): Promise<PokemonResponse> {
  const details = await getPokemonDetails(id.toString());

  if (!details) {
    return {
      content: [
        {
          type: "text",
          text: `No Pokémon found with ID #${id}.`,
        },
      ],
    };
  }

  return formatPokemonResponse(details.pokemon, details.species);
}

// Register Pokémon tools
server.tool(
  "random_pokemon",
  "Rastgele bir Pokémon seç",
  {},
  async (_args, _extra) => {
    return await getRandomPokemon();
  }
);

server.tool(
  "random_pokemon_from_region",
  "Belirli bir bölgeden rastgele bir Pokémon seç",
  {
    region: z
      .string()
      .describe("Pokémon bölgesi (örn: kanto, johto, hoenn, vb.)"),
  },
  async ({ region }, _extra) => {
    return await getRandomPokemonFromRegion(region);
  }
);

server.tool(
  "random_pokemon_by_type",
  "Belirli bir türden rastgele bir Pokémon seç",
  {
    type: z
      .string()
      .describe("Pokémon türü (örn: ateş, su, çimen, vb.)"),
  },
  async ({ type }, _extra) => {
    return await getRandomPokemonByType(type);
  }
);

// Natural language query tool
server.tool(
  "pokemon_query",
  "Doğal dil ile Pokémon sorguları yap",
  {
    query: z.string().describe("Pokémon hakkında doğal dil sorgusu"),
  },
  async ({ query }, _extra) => {
    const normalizedQuery = query.toLowerCase();

    // Check for Pokémon number query
    const numberMatch =
      normalizedQuery.match(/pokemon\s+#?(\d+)/i) ||
      normalizedQuery.match(/hangi\s+pokemon\s+#?(\d+)/i);
    if (numberMatch) {
      const pokemonId = parseInt(numberMatch[1], 10);
      return await getPokemonById(pokemonId);
    }

    // Check for random Pokémon request
    if (
      normalizedQuery.includes("rastgele pokemon") &&
      !normalizedQuery.includes("bölgeden") &&
      !normalizedQuery.includes("türünden")
    ) {
      return await getRandomPokemon();
    }

    // Check for random Pokémon from region
    const regionMatch = normalizedQuery.match(/rastgele pokemon bölgeden (\w+)/i);
    if (regionMatch) {
      const region = regionMatch[1].toLowerCase();
      return await getRandomPokemonFromRegion(region);
    }

    // Check for random Pokémon by type
    const typeMatch =
      normalizedQuery.match(/rastgele (\w+) pokemon/i) ||
      normalizedQuery.match(/rastgele (\w+) türünden pokemon/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      // Check if the matched word is actually a type and not just any adjective
      const validTypes = [
        "normal",
        "fire",
        "water",
        "grass",
        "electric",
        "ice",
        "fighting",
        "poison",
        "ground",
        "flying",
        "psychic",
        "bug",
        "rock",
        "ghost",
        "dragon",
        "dark",
        "steel",
        "fairy",
      ];
      if (validTypes.includes(type)) {
        return await getRandomPokemonByType(type);
      }
    }

    // Default response for unrecognized queries
    return {
      content: [
        {
          type: "text",
          text: `
Pokémon sorguları için yardımcı olabilirim! Şunları deneyebilirsiniz:
- "25 numaralı pokemon nedir?"
- "Bana rastgele bir Pokémon ver"
- "Bana Kanto bölgesinden rastgele bir Pokémon ver"
- "Bana Ateş türünden rastgele bir Pokémon ver"
          `.trim(),
        },
      ],
    };
  }
);

// Battle system functions
async function getPokemonMoves(pokemonId: number): Promise<BattleMove[]> {
  const moves = await fetchFromPokeAPI<any>(`/pokemon/${pokemonId}`);
  if (!moves) return [];

  return moves.moves.slice(0, 4).map((move: any) => ({
    name: move.move.name,
    power: move.move.power || 0,
    accuracy: move.move.accuracy || 100,
    type: move.move.type.name,
    pp: move.move.pp || 20
  }));
}

async function getPokemonStats(pokemonId: number): Promise<BattleStats> {
  const stats = await fetchFromPokeAPI<any>(`/pokemon/${pokemonId}`);
  if (!stats) return {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0
  };

  return {
    hp: stats.stats[0].base_stat,
    attack: stats.stats[1].base_stat,
    defense: stats.stats[2].base_stat,
    specialAttack: stats.stats[3].base_stat,
    specialDefense: stats.stats[4].base_stat,
    speed: stats.stats[5].base_stat
  };
}

async function createBattlePokemon(pokemonId: number, level: number = 50): Promise<BattlePokemon | null> {
  try {
    const pokemon = await fetchFromPokeAPI<Pokemon>(`/pokemon/${pokemonId}`);
    if (!pokemon) return null;

    const moves = await getPokemonMoves(pokemonId);
    const stats = await getPokemonStats(pokemonId);

    return {
      id: pokemon.id,
      name: pokemon.name,
      level,
      types: pokemon.types,
      stats,
      moves,
      currentHp: stats.hp,
      status: { type: 'none', turnsLeft: 0 },
      statModifiers: {
        attack: 0,
        defense: 0,
        specialAttack: 0,
        specialDefense: 0,
        speed: 0
      },
      experience: 0,
      items: []
    };
  } catch (error) {
    console.error("Error creating battle Pokémon:", error);
    return null;
  }
}

// Yeni yardımcı fonksiyonlar
function calculateTypeEffectiveness(attackerType: string, defenderTypes: string[]): number {
  // Type interactions (simple version)
  const typeChart: Record<string, Record<string, number>> = {
    'fire': { 'water': 0.5, 'grass': 2, 'ice': 2 },
    'water': { 'fire': 2, 'grass': 0.5, 'ground': 2 },
    'grass': { 'fire': 0.5, 'water': 2, 'bug': 0.5 },
    // Add more types as needed
  };

  let effectiveness = 1;
  for (const defenderType of defenderTypes) {
    if (typeChart[attackerType]?.[defenderType]) {
      effectiveness *= typeChart[attackerType][defenderType];
    }
  }
  return effectiveness;
}

function applyWeatherEffects(battleState: BattleState): void {
  const weather = battleState.weather;
  if (weather.type === 'sunny') {
    // Fire type moves are boosted
    battleState.battleLog.push('Sunny weather boosts Fire-type moves!');
  } else if (weather.type === 'rainy') {
    // Water type moves are boosted
    battleState.battleLog.push('Rainy weather boosts Water-type moves!');
  }
}

function applyStatusEffects(battleState: BattleState): void {
  // Status effects for player's Pokémon
  if (battleState.playerPokemon.status.type !== 'none') {
    const status = battleState.playerPokemon.status;
    switch (status.type) {
      case 'burn':
        const burnDamage = Math.floor(battleState.playerPokemon.stats.hp * 0.1);
        battleState.playerPokemon.currentHp = Math.max(0, battleState.playerPokemon.currentHp - burnDamage);
        battleState.battleLog.push(`${battleState.playerPokemon.name} took burn damage!`);
        break;
      case 'poison':
        const poisonDamage = Math.floor(battleState.playerPokemon.stats.hp * 0.08);
        battleState.playerPokemon.currentHp = Math.max(0, battleState.playerPokemon.currentHp - poisonDamage);
        battleState.battleLog.push(`${battleState.playerPokemon.name} took poison damage!`);
        break;
    }
    status.turnsLeft--;
    if (status.turnsLeft <= 0) {
      battleState.playerPokemon.status = { type: 'none', turnsLeft: 0 };
      battleState.battleLog.push(`${battleState.playerPokemon.name}'s status returned to normal!`);
    }
  }

  // Similar effects for opponent's Pokémon
  if (battleState.opponentPokemon.status.type !== 'none') {
    const status = battleState.opponentPokemon.status;
    switch (status.type) {
      case 'burn':
        const burnDamage = Math.floor(battleState.opponentPokemon.stats.hp * 0.1);
        battleState.opponentPokemon.currentHp = Math.max(0, battleState.opponentPokemon.currentHp - burnDamage);
        battleState.battleLog.push(`${battleState.opponentPokemon.name} took burn damage!`);
        break;
      case 'poison':
        const poisonDamage = Math.floor(battleState.opponentPokemon.stats.hp * 0.08);
        battleState.opponentPokemon.currentHp = Math.max(0, battleState.opponentPokemon.currentHp - poisonDamage);
        battleState.battleLog.push(`${battleState.opponentPokemon.name} took poison damage!`);
        break;
    }
    status.turnsLeft--;
    if (status.turnsLeft <= 0) {
      battleState.opponentPokemon.status = { type: 'none', turnsLeft: 0 };
      battleState.battleLog.push(`${battleState.opponentPokemon.name}'s status returned to normal!`);
    }
  }
}

// Geliştirilmiş hasar hesaplama
function calculateDamage(attacker: BattlePokemon, defender: BattlePokemon, move: BattleMove): number {
  const attack = move.type === "physical" ? attacker.stats.attack : attacker.stats.specialAttack;
  const defense = move.type === "physical" ? defender.stats.defense : defender.stats.specialDefense;
  
  const level = attacker.level;
  const power = move.power;
  
  // Temel hasar formülü
  let damage = Math.floor(((2 * level / 5 + 2) * power * attack / defense) / 50 + 2);
  
  // Tip etkileşimi
  const typeEffectiveness = calculateTypeEffectiveness(move.type, defender.types.map(t => t.type.name));
  damage *= typeEffectiveness;
  
  // Durum efektleri
  if (attacker.status.type === 'burn' && move.type === 'physical') {
    damage *= 0.5;
  }
  
  // Rastgele faktör (0.85 to 1.00)
  const randomFactor = 0.85 + Math.random() * 0.15;
  damage *= randomFactor;
  
  return Math.floor(damage);
}

function isMoveHit(move: BattleMove): boolean {
  return Math.random() * 100 <= move.accuracy;
}

// Geliştirilmiş savaş turu
async function executeBattleTurn(state: BattleState, playerMoveIndex: number): Promise<BattleState> {
  state.battleLog = []; // Clear log for new turn
  
  // Apply weather effects
  applyWeatherEffects(state);
  
  // Apply status effects
  applyStatusEffects(state);
  
  const playerMove = state.playerPokemon.moves[playerMoveIndex];
  const opponentMove = state.opponentPokemon.moves[Math.floor(Math.random() * state.opponentPokemon.moves.length)];

  // Player's turn
  if (isMoveHit(playerMove)) {
    const damage = calculateDamage(state.playerPokemon, state.opponentPokemon, playerMove);
    state.opponentPokemon.currentHp = Math.max(0, state.opponentPokemon.currentHp - damage);
    state.battleLog.push(`${state.playerPokemon.name} used ${playerMove.name}!`);
    state.battleLog.push(`${state.opponentPokemon.name} took ${damage} damage!`);
  } else {
    state.battleLog.push(`${state.playerPokemon.name}'s move missed!`);
  }

  // Opponent's turn (if still alive)
  if (state.opponentPokemon.currentHp > 0 && isMoveHit(opponentMove)) {
    const damage = calculateDamage(state.opponentPokemon, state.playerPokemon, opponentMove);
    state.playerPokemon.currentHp = Math.max(0, state.playerPokemon.currentHp - damage);
    state.battleLog.push(`${state.opponentPokemon.name} used ${opponentMove.name}!`);
    state.battleLog.push(`${state.playerPokemon.name} took ${damage} damage!`);
  } else if (state.opponentPokemon.currentHp > 0) {
    state.battleLog.push(`${state.opponentPokemon.name}'s move missed!`);
  }

  state.turn++;
  return state;
}

async function startBattle(playerPokemonId: number, opponentPokemonId: number): Promise<BattleState> {
  const playerPokemon = await createBattlePokemon(playerPokemonId);
  const opponentPokemon = await createBattlePokemon(opponentPokemonId);

  if (!playerPokemon || !opponentPokemon) {
    throw new Error("Failed to create battle Pokémon");
  }

  return {
    playerPokemon,
    opponentPokemon,
    turn: 1,
    weather: { type: 'none', turnsLeft: 0 },
    status: 'active',
    battleLog: []
  };
}

// Update battle commands to use tool instead of addCommand
server.tool(
  "start_battle",
  "Start a battle between two Pokémon",
  {
    playerPokemonId: z.number().describe("Player's Pokémon ID"),
    opponentPokemonId: z.number().describe("Opponent's Pokémon ID")
  },
  async (params) => {
    try {
      const battleState = await startBattle(params.playerPokemonId, params.opponentPokemonId);
      currentBattle = battleState;
      
      return {
        content: [
          {
            type: "text",
            text: `Battle started!\n${battleState.playerPokemon.name} vs ${battleState.opponentPokemon.name}\n\n${battleState.playerPokemon.name} HP: ${battleState.playerPokemon.currentHp}/${battleState.playerPokemon.stats.hp}\n${battleState.opponentPokemon.name} HP: ${battleState.opponentPokemon.currentHp}/${battleState.opponentPokemon.stats.hp}\n\nAvailable moves:\n${battleState.playerPokemon.moves.map((move, index) => `${index}: ${move.name}`).join('\n')}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to start battle: ${error.message || 'Unknown error occurred'}`
          }
        ]
      };
    }
  }
);

server.tool(
  "make_move",
  "Make a move in the current battle",
  {
    moveIndex: z.number().min(0).max(3).describe("Index of the move to use (0-3)")
  },
  async (params) => {
    if (!currentBattle) {
      return {
        content: [
          {
            type: "text",
            text: "No active battle! Start a battle first using the start_battle command."
          }
        ]
      };
    }

    const battleState = await executeBattleTurn(currentBattle, params.moveIndex);
    currentBattle = battleState;

    const playerMove = battleState.playerPokemon.moves[params.moveIndex];
    const opponentMove = battleState.opponentPokemon.moves[Math.floor(Math.random() * battleState.opponentPokemon.moves.length)];

    let battleLog = `Turn ${battleState.turn}:\n`;
    battleLog += `${battleState.playerPokemon.name} used ${playerMove.name}!\n`;
    battleLog += `${battleState.opponentPokemon.name} used ${opponentMove.name}!\n\n`;

    battleLog += `${battleState.playerPokemon.name} HP: ${battleState.playerPokemon.currentHp}/${battleState.playerPokemon.stats.hp}\n`;
    battleLog += `${battleState.opponentPokemon.name} HP: ${battleState.opponentPokemon.currentHp}/${battleState.opponentPokemon.stats.hp}\n`;

    // Check for battle end
    if (battleState.playerPokemon.currentHp <= 0 || battleState.opponentPokemon.currentHp <= 0) {
      const winner = battleState.playerPokemon.currentHp <= 0 ? battleState.opponentPokemon.name : battleState.playerPokemon.name;
      battleLog += `\nBattle ended! ${winner} won!`;
      currentBattle = null;
    }

    return {
      content: [
        {
          type: "text",
          text: battleLog
        }
      ]
    };
  }
);

// Yeni komutlar ekle
server.tool(
  "use_item",
  "Use an item in battle",
  {
    itemIndex: z.number().min(0).describe("Index of the item to use")
  },
  async (params) => {
    if (!currentBattle) {
      return {
        content: [
          {
            type: "text",
            text: "No active battle! Start a battle first using the start_battle command."
          }
        ]
      };
    }

    const item = currentBattle.playerPokemon.items[params.itemIndex];
    if (!item) {
      return {
        content: [
          {
            type: "text",
            text: "Invalid item index!"
          }
        ]
      };
    }

    // Apply item effects
    if (item.effect.heal) {
      currentBattle.playerPokemon.currentHp = Math.min(
        currentBattle.playerPokemon.stats.hp,
        currentBattle.playerPokemon.currentHp + item.effect.heal
      );
      currentBattle.battleLog.push(`${currentBattle.playerPokemon.name} recovered ${item.effect.heal} HP!`);
    }

    // Mark item as used
    currentBattle.playerPokemon.items.splice(params.itemIndex, 1);

    return {
      content: [
        {
          type: "text",
          text: currentBattle.battleLog.join('\n')
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pokédex MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

