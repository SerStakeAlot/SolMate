'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export const ChessGame: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [wagerAmount, setWagerAmount] = useState('0.1');

  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Chess Board Placeholder */}
        <div className="md:col-span-2">
          <div className="aspect-square bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 rounded-lg shadow-inner p-2">
            <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-0 bg-amber-900 rounded">
              {Array.from({ length: 64 }).map((_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const isLight = (row + col) % 2 === 0;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center text-4xl ${
                      isLight ? 'bg-amber-100' : 'bg-amber-700'
                    }`}
                  >
                    {/* Chess pieces will be rendered here */}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-center text-gray-400 mt-4 text-sm">
            Chess game interface coming soon
          </p>
        </div>

        {/* Game Controls */}
        <div className="space-y-6">
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Game Settings</h3>
            
            {connected ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Wager Amount (SOL)
                  </label>
                  <input
                    type="number"
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    step="0.01"
                    min="0"
                  />
                </div>

                <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all">
                  Create Game
                </button>

                <button className="w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all">
                  Join Game
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">
                  Connect your wallet to play
                </p>
                <div className="text-4xl mb-2">🔒</div>
              </div>
            )}
          </div>

          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Side Bets</h3>
            <p className="text-gray-400 text-sm mb-4">
              Place bets on ongoing matches
            </p>
            <div className="space-y-2">
              <div className="bg-gray-800 p-3 rounded">
                <p className="text-xs text-gray-400">No active games</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Your Stats</h3>
            {connected ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Games Played:</span>
                  <span className="font-semibold">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Wins:</span>
                  <span className="font-semibold text-green-400">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Wagered:</span>
                  <span className="font-semibold">0 SOL</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Connect wallet to view stats</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
