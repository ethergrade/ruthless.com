import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { GameState } from '../../../types';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_OFFSET_X = 400;
const MAP_OFFSET_Y = 100;

interface SceneData {
  tileSprites: Map<string, Phaser.GameObjects.Image>;
  buildings: Map<string, Phaser.GameObjects.Graphics>;
  companyColors: Map<string, number>;
}

const sceneDataRef = { current: null as SceneData | null };

export const MarketMap: React.FC<{ 
  state: GameState | null; 
  selectedTileId: string | null; 
  onTileSelect: (tileId: string | null) => void; 
}> = ({ state, selectedTileId, onTileSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || !state) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.WEBGL,
      parent: containerRef.current,
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 600,
      backgroundColor: '#0a0a12',
      scene: {
        preload,
        create,
        update,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [state, selectedTileId]);

  function preload(this: Phaser.Scene) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.lineStyle(1, 0x2a2a4a);
    g.strokeRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.generateTexture('tile_base', TILE_WIDTH, TILE_HEIGHT);

    g.clear();
    g.fillStyle(0x00d4aa, 0.3);
    g.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.lineStyle(2, 0x00d4aa);
    g.strokeRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.generateTexture('tile_player', TILE_WIDTH, TILE_HEIGHT);

    g.clear();
    g.fillStyle(0xff6b35, 0.3);
    g.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.lineStyle(2, 0xff6b35);
    g.strokeRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.generateTexture('tile_enemy', TILE_WIDTH, TILE_HEIGHT);

    g.clear();
    g.fillStyle(0x007bff, 0.3);
    g.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.lineStyle(2, 0x007bff);
    g.strokeRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    g.generateTexture('tile_contested', TILE_WIDTH, TILE_HEIGHT);

    g.clear();
    g.fillStyle(0x1a1a2e, 0.8);
    g.fillRoundedRect(0, 0, 200, 100, 8);
    g.lineStyle(1, 0x00d4aa, 0.5);
    g.strokeRoundedRect(0, 0, 200, 100, 8);
    g.generateTexture('tooltip_bg', 200, 100);

    g.destroy();
  }

  function create(this: Phaser.Scene) {
    const { marketTiles, companies } = state!;
    const companyColors = new Map<string, number>();
      companies.forEach((c) => {
      companyColors.set(c.id, Phaser.Display.Color.HexStringToColor(c.color).color);
    });

    const tileSprites = new Map<string, Phaser.GameObjects.Image>();
    const buildings = new Map<string, Phaser.GameObjects.Graphics>();

    marketTiles.forEach((tile, id) => {
      const isoX = (tile.x - tile.y) * (TILE_WIDTH / 2) + MAP_OFFSET_X;
      const isoY = (tile.x + tile.y) * (TILE_HEIGHT / 2) + MAP_OFFSET_Y;

      let texture = 'tile_base';
      if (tile.controllerId) {
        if (tile.challengerId && tile.challengerId !== tile.controllerId) {
          texture = 'tile_contested';
        } else if (tile.controllerId === state!.playerCompanyId) {
          texture = 'tile_player';
        } else {
          texture = 'tile_enemy';
        }
      }

      const tileSprite = this.add.image(isoX, isoY, texture).setDepth(1).setInteractive();
      tileSprite.setData('tileId', id);
      tileSprites.set(id, tileSprite);

      tileSprite.on('pointerover', () => {
        tileSprite.setTint(0xffffff);
        this.input.setDefaultCursor('pointer');
      });

      tileSprite.on('pointerout', () => {
        tileSprite.clearTint();
        this.input.setDefaultCursor('default');
      });

      tileSprite.on('pointerdown', () => {
        onTileSelect(id);
      });

      if (tile.controllerId) {
        const color = companyColors.get(tile.controllerId) || 0xffffff;
        const building = this.add.graphics();
        building.setDepth(2);
        building.fillStyle(color, 0.8);
        const height = 20 + tile.controlStrength * 30;
        building.fillRect(isoX - 12, isoY - height - 8, 24, height);
        building.fillStyle(0x000000, 0.5);
        building.fillRect(isoX - 10, isoY - height - 6, 20, height - 4);
        buildings.set(id, building);
      }

      if (tile.productId) {
        this.add.circle(isoX + 20, isoY - 20, 6, 0x00d4aa, 1).setDepth(3);
      }
    });

    const tooltip = this.add.container(0, 0).setDepth(100).setVisible(false);
    const tooltipBg = this.add.image(0, 0, 'tooltip_bg').setOrigin(0);
    const tooltipText = this.add.text(12, 12, '', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#e8e8f0',
      lineSpacing: 4,
    });
    tooltip.add([tooltipBg, tooltipText]);

    this.input.on('gameobjectover', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const tileId = gameObject.getData('tileId');
      if (tileId) {
        const tile = marketTiles.get(tileId);
        if (tile) {
          const controller = tile.controllerId ? companies.get(tile.controllerId) : null;
          const challenger = tile.challengerId ? companies.get(tile.challengerId) : null;

          let text = `${tileId.replace('tile_', '').toUpperCase()}\n`;
          text += `Segment: ${tile.segment.replace('_', ' ')}\n`;
          text += `Value: $${tile.value.toLocaleString()}\n`;
          text += `Growth: ${(tile.growth * 100).toFixed(1)}%\n`;
          text += `Risk: ${(tile.risk * 100).toFixed(0)}%\n`;
          text += `Control: ${(tile.controlStrength * 100).toFixed(0)}%\n`;

          if (controller) {
            text += `\nOwner: ${controller.name}`;
          }
          if (challenger) {
            text += `\nChallenger: ${challenger.name}`;
          }

          tooltipText.setText(text);
          tooltipBg.setDisplaySize(tooltipText.width + 24, tooltipText.height + 24);

          const x = (gameObject as Phaser.GameObjects.Image).x + 40;
          const y = (gameObject as Phaser.GameObjects.Image).y - tooltipText.height - 24;
          tooltip.setPosition(x, y).setVisible(true);
        }
      }
    });

    this.input.on('gameobjectout', () => {
      tooltip.setVisible(false);
    });

    sceneDataRef.current = { tileSprites, buildings, companyColors };
  }

  function update(this: Phaser.Scene) {
    const mapData = sceneDataRef.current;
    if (!mapData) return;

    const { marketTiles } = state!;
    const { tileSprites, buildings, companyColors } = mapData;

    marketTiles.forEach((tile, id) => {
      const sprite = tileSprites.get(id);
      if (!sprite) return;

      let texture = 'tile_base';
      if (tile.controllerId) {
        if (tile.challengerId && tile.challengerId !== tile.controllerId) {
          texture = 'tile_contested';
        } else if (tile.controllerId === state!.playerCompanyId) {
          texture = 'tile_player';
        } else {
          texture = 'tile_enemy';
        }
      }

      sprite.setTexture(texture);

      if (id === selectedTileId) {
        sprite.setTint(0xffc107);
      } else {
        sprite.clearTint();
      }

      const building = buildings.get(id);
      if (building) {
        building.clear();
        const color = companyColors.get(tile.controllerId!) || 0xffffff;
        const isoX = (tile.x - tile.y) * (TILE_WIDTH / 2) + MAP_OFFSET_X;
        const isoY = (tile.x + tile.y) * (TILE_HEIGHT / 2) + MAP_OFFSET_Y;
        const height = 20 + tile.controlStrength * 30;
        building.fillStyle(color, 0.8);
        building.fillRect(isoX - 12, isoY - height - 8, 24, height);
        building.fillStyle(0x000000, 0.5);
        building.fillRect(isoX - 10, isoY - height - 6, 20, height - 4);
      }
    });
  }

  return <div ref={containerRef} className="market-map-container" />;
}
