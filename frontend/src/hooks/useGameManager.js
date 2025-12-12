import { useGameContext } from '../contexts/GameContext';

/**
 * Hook for accessing game manager functionality
 * Provides a convenient interface for components that need game management
 */
export function useGameManager() {
  const context = useGameContext();

  return {
    // State
    games: context.games,
    visibleGames: context.visibleGames,
    enabledGames: context.enabledGames,
    featuredGames: context.featuredGames,
    loading: context.loading,
    error: context.error,
    isOwner: context.isOwner,

    // Methods
    isGamePlayable: context.isGamePlayable,
    getGame: context.getGame,
    getGameIcon: context.getGameIcon,

    // Admin methods (require owner)
    setGameEnabled: context.setGameEnabled,
    setGameVisible: context.setGameVisible,
    setGameFeatured: context.setGameFeatured,
    addGame: context.addGame,
    removeGame: context.removeGame,

    // Dev helper (works without contract)
    devToggleGame: context.devToggleGame
  };
}

/**
 * Hook to check if a specific game is available
 */
export function useGameAvailable(gameId) {
  const { isGamePlayable, getGame } = useGameContext();

  const game = getGame(gameId);
  const isPlayable = isGamePlayable(gameId);

  return {
    game,
    isPlayable,
    isVisible: game?.visible ?? false,
    isEnabled: game?.enabled ?? false,
    isFeatured: game?.featured ?? false
  };
}

/**
 * Hook to get active games for navigation
 */
export function useActiveGames() {
  const { visibleGames, enabledGames, getGameIcon } = useGameContext();

  return {
    visibleGames,
    enabledGames,
    getGameIcon
  };
}

export default useGameManager;
