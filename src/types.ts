// Interface definitions
export interface PokemonResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  [key: string]: unknown;
}

export interface PokemonSpecies {
  name: string;
  url: string;
}

export interface GenerationData {
  pokemon_species: PokemonSpecies[];
}

export interface PokemonType {
  type: {
    name: string;
  };
}

export interface PokemonAbility {
  ability: {
    name: string;
  };
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: {
    name: string;
  };
}

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: PokemonType[];
  abilities: PokemonAbility[];
  sprites: {
    front_default: string;
  };
}

export interface PokemonSpeciesDetails {
  flavor_text_entries: FlavorTextEntry[];
}

export interface TypeData {
  pokemon: {
    pokemon: {
      name: string;
      url: string;
    };
  }[];
}

// Response type for formatted Pokémon data
export interface PokemonResponse {
  content: {
    type: "text";
    text: string;
  }[];
}

// Battle related interfaces
export interface BattleStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattleMove {
  name: string;
  power: number;
  accuracy: number;
  type: string;
  pp: number;
}

// Gelişmiş savaş sistemi için yeni tipler
export interface PokemonStatus {
  type: 'none' | 'burn' | 'poison' | 'paralyze' | 'sleep';
  turnsLeft: number;
}

export interface BattleItem {
  name: string;
  effect: {
    heal?: number;
    status?: 'none' | 'burn' | 'poison' | 'paralyze' | 'sleep';
    statBoost?: {
      stat: 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';
      amount: number;
    };
  };
}

export interface BattleWeather {
  type: 'none' | 'sunny' | 'rainy' | 'sandstorm' | 'hail';
  turnsLeft: number;
}

// Geliştirilmiş BattlePokemon interface'i
export interface BattlePokemon {
  id: number;
  name: string;
  level: number;
  types: PokemonType[];
  stats: BattleStats;
  moves: BattleMove[];
  currentHp: number;
  status: PokemonStatus;
  statModifiers: {
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  experience: number;
  items: BattleItem[];
}

// Geliştirilmiş BattleState interface'i
export interface BattleState {
  playerPokemon: BattlePokemon;
  opponentPokemon: BattlePokemon;
  turn: number;
  weather: BattleWeather;
  status: string;
  battleLog: string[];
}

export interface BattleResult {
  winner: string;
  turns: number;
  log: string[];
}
