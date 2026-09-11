const { escapeXml, getForwardDelta } = require("./doom-core");
const {
  getEnemyTextureUri,
  getSurfaceTextureUri,
  getTextureSymbolId,
  renderCroppedTextureRectById,
  TEXTURE_VIRTUAL_SIZE
} = require("./doom-textures");

const VIEWPORT_RENDER_BOX = {
  x: 10,
  y: 11,
  width: 700,
  height: 340,
  internalWidth: 140,
  internalHeight: 68,
  pixelWidth: 5,
  pixelHeight: 5
};

const CAMERA_PLANE_SCALE = 0.66;
const FLOOR_SAMPLE_HEIGHT = 1;
const MAX_RENDER_DISTANCE = 24;
const MIN_DISTANCE = 0.0001;
const MIN_TEXEL_SPAN = 0.5;
const ENEMY_MOVE_BEGIN = "0.54s";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getCamera(state) {
  const forward = getForwardDelta(state.player.facing);

  return {
    posX: state.player.x + 0.5,
    posY: state.player.y + 0.5,
    dirX: forward.x,
    dirY: forward.y,
    planeX: -forward.y * CAMERA_PLANE_SCALE,
    planeY: forward.x * CAMERA_PLANE_SCALE
  };
}

function getLightLevel(distance, extraDarkness = 0) {
  return clamp(1 - Math.min(0.82, 0.08 + (distance * 0.055) + extraDarkness), 0.16, 1);
}

function createTextureLookup(state) {
  const surfaceCache = new Map();
  const enemyCache = new Map();

  return {
    surface(surfaceType, cellX, cellY) {
      const key = `${surfaceType}:${cellX}:${cellY}`;
      if (!surfaceCache.has(key)) {
        surfaceCache.set(key, getSurfaceTextureUri(state, surfaceType, `${cellX}:${cellY}`));
      }
      return surfaceCache.get(key);
    },
    enemy(enemy) {
      if (!enemy) {
        return "";
      }
      if (!enemyCache.has(enemy.id)) {
        enemyCache.set(enemy.id, getEnemyTextureUri(state, enemy));
      }
      return enemyCache.get(enemy.id);
    }
  };
}

function castRay(state, camera, column) {
  const cameraX = ((2 * column) / VIEWPORT_RENDER_BOX.internalWidth) - 1;
  const rayDirX = camera.dirX + (camera.planeX * cameraX);
  const rayDirY = camera.dirY + (camera.planeY * cameraX);

  let mapX = Math.floor(camera.posX);
  let mapY = Math.floor(camera.posY);

  const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
  const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

  let stepX = 0;
  let stepY = 0;
  let sideDistX = 0;
  let sideDistY = 0;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (camera.posX - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = ((mapX + 1) - camera.posX) * deltaDistX;
  }

  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (camera.posY - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = ((mapY + 1) - camera.posY) * deltaDistY;
  }

  let side = 0;
  let hit = false;
  let steps = 0;

  while (!hit && steps < 128) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    if (
      mapY < 0 ||
      mapY >= state.mapRows.length ||
      mapX < 0 ||
      mapX >= state.mapRows[0].length ||
      state.mapRows[mapY][mapX] === "#"
    ) {
      hit = true;
    }

    steps += 1;
  }

  const distance = Math.max(
    MIN_DISTANCE,
    side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY
  );
  const lineHeight = Math.max(1, Math.floor(VIEWPORT_RENDER_BOX.internalHeight / distance));
  const drawStart = Math.max(0, Math.floor((VIEWPORT_RENDER_BOX.internalHeight - lineHeight) / 2));
  const drawEnd = Math.min(
    VIEWPORT_RENDER_BOX.internalHeight - 1,
    Math.floor((VIEWPORT_RENDER_BOX.internalHeight + lineHeight) / 2)
  );

  let wallX = side === 0
    ? camera.posY + (distance * rayDirY)
    : camera.posX + (distance * rayDirX);
  wallX -= Math.floor(wallX);

  let textureX = Math.floor(wallX * TEXTURE_VIRTUAL_SIZE);
  if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) {
    textureX = TEXTURE_VIRTUAL_SIZE - textureX - 1;
  }

  return {
    column,
    side,
    distance,
    cellX: mapX,
    cellY: mapY,
    textureX: clamp(textureX, 0, TEXTURE_VIRTUAL_SIZE - 1),
    drawStart,
    drawEnd
  };
}

function projectBillboard(frame, worldX, worldY, widthScale = 1, heightScale = widthScale) {
  const { camera, zBuffer } = frame;
  const relativeX = worldX - camera.posX;
  const relativeY = worldY - camera.posY;
  const determinant = (camera.planeX * camera.dirY) - (camera.dirX * camera.planeY);
  if (Math.abs(determinant) <= MIN_DISTANCE) {
    return null;
  }

  const inverseDeterminant = 1 / determinant;
  const transformX = inverseDeterminant * ((camera.dirY * relativeX) - (camera.dirX * relativeY));
  const transformY = inverseDeterminant * ((-camera.planeY * relativeX) + (camera.planeX * relativeY));

  if (transformY <= 0.15 || transformY > MAX_RENDER_DISTANCE) {
    return null;
  }

  const spriteScreenX = Math.floor((VIEWPORT_RENDER_BOX.internalWidth / 2) * (1 + (transformX / transformY)));
  const spriteHeight = Math.max(1, Math.floor((VIEWPORT_RENDER_BOX.internalHeight / transformY) * heightScale));
  const spriteWidth = Math.max(1, Math.floor((VIEWPORT_RENDER_BOX.internalHeight / transformY) * widthScale));
  const startY = Math.max(0, Math.floor((VIEWPORT_RENDER_BOX.internalHeight - spriteHeight) / 2));
  const endY = Math.min(VIEWPORT_RENDER_BOX.internalHeight - 1, startY + spriteHeight - 1);
  const startX = Math.max(0, Math.floor(spriteScreenX - (spriteWidth / 2)));
  const endX = Math.min(VIEWPORT_RENDER_BOX.internalWidth - 1, Math.floor(spriteScreenX + (spriteWidth / 2)));

  if (endX < startX || endY < startY) {
    return null;
  }

  let visible = false;
  for (let stripe = startX; stripe <= endX; stripe += 1) {
    if (!zBuffer || transformY <= (zBuffer[stripe] || MAX_RENDER_DISTANCE + 1)) {
      visible = true;
      break;
    }
  }

  if (!visible) {
    return null;
  }

  return {
    distance: transformY,
    leftEdge: spriteScreenX - (spriteWidth / 2),
    startX,
    endX,
    startY,
    endY,
    width: spriteWidth,
    height: spriteHeight
  };
}

// Columns where a row crosses into the next floor tile, snapped to the column grid so neighbouring
// patches share an edge exactly and cannot leave a seam. Only one world axis moves along a row,
// because the camera always faces an axis.
function getRowTileBoundaries(origin, step) {
  const boundaries = [0];

  if (Math.abs(step) > MIN_DISTANCE) {
    const rowStart = origin;
    const rowEnd = origin + (step * VIEWPORT_RENDER_BOX.internalWidth);

    for (let tile = Math.ceil(Math.min(rowStart, rowEnd)); tile <= Math.floor(Math.max(rowStart, rowEnd)); tile += 1) {
      const column = Math.round((tile - origin) / step);
      if (column > 0 && column < VIEWPORT_RENDER_BOX.internalWidth) {
        boundaries.push(column);
      }
    }

    boundaries.sort((left, right) => left - right);
  }

  boundaries.push(VIEWPORT_RENDER_BOX.internalWidth);
  return boundaries;
}

// The camera always faces an axis, so the patch of floor behind each slice is an axis-aligned
// rectangle in world space. Mapping that whole rectangle onto the slice draws the texels it really
// covers; sampling one texel per fixed block is what made the floor and ceiling look so blocky.
function collectFloorSamples(camera, textureLookup) {
  const samples = [];
  const leftRayX = camera.dirX - camera.planeX;
  const leftRayY = camera.dirY - camera.planeY;
  const rightRayX = camera.dirX + camera.planeX;
  const rightRayY = camera.dirY + camera.planeY;
  const halfHeight = VIEWPORT_RENDER_BOX.internalHeight / 2;
  const posZ = halfHeight;

  for (let row = Math.floor(halfHeight) + 1; row < VIEWPORT_RENDER_BOX.internalHeight; row += FLOOR_SAMPLE_HEIGHT) {
    const topDistance = posZ / Math.max(MIN_DISTANCE, row - halfHeight);
    const bottomDistance = posZ / Math.max(MIN_DISTANCE, (row + FLOOR_SAMPLE_HEIGHT) - halfHeight);
    const topStepX = (topDistance * (rightRayX - leftRayX)) / VIEWPORT_RENDER_BOX.internalWidth;
    const topStepY = (topDistance * (rightRayY - leftRayY)) / VIEWPORT_RENDER_BOX.internalWidth;
    const bottomStepX = (bottomDistance * (rightRayX - leftRayX)) / VIEWPORT_RENDER_BOX.internalWidth;
    const bottomStepY = (bottomDistance * (rightRayY - leftRayY)) / VIEWPORT_RENDER_BOX.internalWidth;
    const topOriginX = camera.posX + (topDistance * leftRayX);
    const topOriginY = camera.posY + (topDistance * leftRayY);
    const bottomOriginX = camera.posX + (bottomDistance * leftRayX);
    const bottomOriginY = camera.posY + (bottomDistance * leftRayY);
    const floorY = VIEWPORT_RENDER_BOX.y + (row * VIEWPORT_RENDER_BOX.pixelHeight);
    const ceilingY = VIEWPORT_RENDER_BOX.y + ((VIEWPORT_RENDER_BOX.internalHeight - row - FLOOR_SAMPLE_HEIGHT) * VIEWPORT_RENDER_BOX.pixelHeight);
    const sampleHeight = VIEWPORT_RENDER_BOX.pixelHeight * FLOOR_SAMPLE_HEIGHT;
    const floorLight = getLightLevel(topDistance, 0.16);
    const ceilingLight = getLightLevel(topDistance, 0.24);

    const horizontalAxisIsX = Math.abs(topStepX) >= Math.abs(topStepY);
    const boundaries = getRowTileBoundaries(
      horizontalAxisIsX ? topOriginX : topOriginY,
      horizontalAxisIsX ? topStepX : topStepY
    );

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const column = boundaries[index];
      const nextColumn = boundaries[index + 1];
      if (nextColumn <= column) {
        continue;
      }

      const worldXs = [
        topOriginX + (topStepX * column),
        topOriginX + (topStepX * nextColumn),
        bottomOriginX + (bottomStepX * column),
        bottomOriginX + (bottomStepX * nextColumn)
      ];
      const worldYs = [
        topOriginY + (topStepY * column),
        topOriginY + (topStepY * nextColumn),
        bottomOriginY + (bottomStepY * column),
        bottomOriginY + (bottomStepY * nextColumn)
      ];
      const minWorldX = Math.min(...worldXs);
      const maxWorldX = Math.max(...worldXs);
      const minWorldY = Math.min(...worldYs);
      const maxWorldY = Math.max(...worldYs);
      const cellX = Math.floor((minWorldX + maxWorldX) / 2);
      const cellY = Math.floor((minWorldY + maxWorldY) / 2);
      const screenX = VIEWPORT_RENDER_BOX.x + (column * VIEWPORT_RENDER_BOX.pixelWidth);
      const screenWidth = Math.min(
        VIEWPORT_RENDER_BOX.pixelWidth * (nextColumn - column),
        VIEWPORT_RENDER_BOX.x + VIEWPORT_RENDER_BOX.width - screenX
      );
      // Held inside the tile, so a patch never bleeds into a neighbour drawn with another texture.
      const viewX = clamp((minWorldX - cellX) * TEXTURE_VIRTUAL_SIZE, 0, TEXTURE_VIRTUAL_SIZE - MIN_TEXEL_SPAN);
      const viewY = clamp((minWorldY - cellY) * TEXTURE_VIRTUAL_SIZE, 0, TEXTURE_VIRTUAL_SIZE - MIN_TEXEL_SPAN);
      const viewWidth = clamp((maxWorldX - minWorldX) * TEXTURE_VIRTUAL_SIZE, MIN_TEXEL_SPAN, TEXTURE_VIRTUAL_SIZE - viewX);
      const viewHeight = clamp((maxWorldY - minWorldY) * TEXTURE_VIRTUAL_SIZE, MIN_TEXEL_SPAN, TEXTURE_VIRTUAL_SIZE - viewY);
      const floorTexture = textureLookup.surface("floor", cellX, cellY);
      const ceilingTexture = textureLookup.surface("ceiling", cellX, cellY);

      if (floorTexture) {
        samples.push({
          textureUri: floorTexture,
          x: screenX,
          y: floorY,
          width: screenWidth,
          height: sampleHeight,
          viewX,
          viewY,
          viewWidth,
          viewHeight,
          light: floorLight
        });
      }

      if (ceilingTexture) {
        samples.push({
          textureUri: ceilingTexture,
          x: screenX,
          y: Math.max(VIEWPORT_RENDER_BOX.y, ceilingY),
          width: screenWidth,
          height: sampleHeight,
          viewX,
          viewY,
          viewWidth,
          viewHeight,
          light: ceilingLight
        });
      }
    }
  }

  return samples;
}

function renderFloorSamples(samples) {
  return samples
    .map((sample) => renderCroppedTextureRectById(
      sample.x,
      sample.y,
      sample.width,
      sample.height,
      getTextureSymbolId(sample.textureUri),
      sample.viewX,
      sample.viewY,
      sample.viewWidth,
      sample.viewHeight,
      sample.light
    ))
    .join("\n");
}

function renderWalls(rays, textureLookup) {
  const pieces = [];

  for (const ray of rays) {
    const textureUri = textureLookup.surface("wall", ray.cellX, ray.cellY);
    if (!textureUri) {
      continue;
    }

    pieces.push(renderCroppedTextureRectById(
      VIEWPORT_RENDER_BOX.x + (ray.column * VIEWPORT_RENDER_BOX.pixelWidth),
      VIEWPORT_RENDER_BOX.y + (ray.drawStart * VIEWPORT_RENDER_BOX.pixelHeight),
      VIEWPORT_RENDER_BOX.pixelWidth,
      Math.max(
        VIEWPORT_RENDER_BOX.pixelHeight,
        (ray.drawEnd - ray.drawStart + 1) * VIEWPORT_RENDER_BOX.pixelHeight
      ),
      getTextureSymbolId(textureUri),
      ray.textureX,
      0,
      1,
      TEXTURE_VIRTUAL_SIZE,
      getLightLevel(ray.distance, ray.side === 1 ? 0.08 : 0)
    ));
  }

  return pieces.join("\n");
}

function getScreenBounds(projection) {
  return {
    x: VIEWPORT_RENDER_BOX.x + (projection.startX * VIEWPORT_RENDER_BOX.pixelWidth),
    y: VIEWPORT_RENDER_BOX.y + (projection.startY * VIEWPORT_RENDER_BOX.pixelHeight),
    width: Math.max(
      VIEWPORT_RENDER_BOX.pixelWidth,
      (projection.endX - projection.startX + 1) * VIEWPORT_RENDER_BOX.pixelWidth
    ),
    height: Math.max(
      VIEWPORT_RENDER_BOX.pixelHeight,
      (projection.endY - projection.startY + 1) * VIEWPORT_RENDER_BOX.pixelHeight
    )
  };
}

function getBoundsUnion(...boundsList) {
  const validBounds = boundsList.filter(Boolean);
  if (validBounds.length === 0) {
    return null;
  }

  const left = Math.min(...validBounds.map((bounds) => bounds.x));
  const top = Math.min(...validBounds.map((bounds) => bounds.y));
  const right = Math.max(...validBounds.map((bounds) => bounds.x + bounds.width));
  const bottom = Math.max(...validBounds.map((bounds) => bounds.y + bounds.height));

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function collectVisibleStripeRanges(projection, zBuffer) {
  const ranges = [];
  let rangeStart = null;

  for (let stripe = projection.startX; stripe <= projection.endX; stripe += 1) {
    const visible = projection.distance <= (zBuffer[stripe] || MAX_RENDER_DISTANCE + 1);

    if (visible && rangeStart === null) {
      rangeStart = stripe;
      continue;
    }

    if (!visible && rangeStart !== null) {
      ranges.push({ start: rangeStart, end: stripe - 1 });
      rangeStart = null;
    }
  }

  if (rangeStart !== null) {
    ranges.push({ start: rangeStart, end: projection.endX });
  }

  return ranges;
}

function renderEnemies(state, frame, textureLookup) {
  const pieces = [];
  const previousEnemies = new Map(
    Array.isArray(state.lastEnemies)
      ? state.lastEnemies.map((enemy) => [enemy.id, enemy])
      : []
  );
  const enemies = state.enemies
    .map((enemy) => ({
      enemy,
      distance: ((enemy.x + 0.5 - frame.camera.posX) ** 2) + ((enemy.y + 0.5 - frame.camera.posY) ** 2)
    }))
    .sort((left, right) => right.distance - left.distance);

  for (const entry of enemies) {
    const projection = projectBillboard(frame, entry.enemy.x + 0.5, entry.enemy.y + 0.5);
    const textureUri = textureLookup.enemy(entry.enemy);
    if (!projection || !textureUri) {
      continue;
    }

    const visibleRanges = collectVisibleStripeRanges(projection, frame.zBuffer);
    if (visibleRanges.length === 0) {
      continue;
    }

    const currentBounds = getScreenBounds(projection);
    const previousEnemy = previousEnemies.get(entry.enemy.id);
    const previousProjection = previousEnemy
      ? projectBillboard(frame, previousEnemy.x + 0.5, previousEnemy.y + 0.5)
      : null;
    const previousBounds = previousProjection ? getScreenBounds(previousProjection) : null;
    const hasMovementAnimation = Boolean(
      previousBounds && (
        previousBounds.x !== currentBounds.x ||
        previousBounds.y !== currentBounds.y ||
        previousBounds.width !== currentBounds.width ||
        previousBounds.height !== currentBounds.height
      )
    );
    const bobOffset = 2 + (((entry.enemy.id.charCodeAt(entry.enemy.id.length - 1) || 0) + state.turn) % 2);
    const clipId = `enemy-clip-${entry.enemy.id}-${state.turn}`;
    const light = getLightLevel(projection.distance, 0.05);
    const visibleBounds = getBoundsUnion(...visibleRanges.map((range) => ({
      x: VIEWPORT_RENDER_BOX.x + (range.start * VIEWPORT_RENDER_BOX.pixelWidth),
      y: currentBounds.y,
      width: (range.end - range.start + 1) * VIEWPORT_RENDER_BOX.pixelWidth,
      height: currentBounds.height
    })));
    const clipBounds = getBoundsUnion(visibleBounds, hasMovementAnimation ? previousBounds : null) || currentBounds;
    const movementBegin = ENEMY_MOVE_BEGIN;
    const movementDurationMs = 240;
    const movementMarkup = hasMovementAnimation
      ? `
      <animate attributeName="x" begin="${movementBegin}" dur="${movementDurationMs}ms" from="${previousBounds.x}" to="${currentBounds.x}" fill="freeze" />
      <animate attributeName="y" begin="${movementBegin}" dur="${movementDurationMs}ms" from="${previousBounds.y}" to="${currentBounds.y}" fill="freeze" />
      <animate attributeName="width" begin="${movementBegin}" dur="${movementDurationMs}ms" from="${previousBounds.width}" to="${currentBounds.width}" fill="freeze" />
      <animate attributeName="height" begin="${movementBegin}" dur="${movementDurationMs}ms" from="${previousBounds.height}" to="${currentBounds.height}" fill="freeze" />`
      : "";
    const bobBegin = hasMovementAnimation
      ? `${Number.parseFloat(movementBegin) + (movementDurationMs / 1000)}s`
      : "0s";

    pieces.push(`
    <defs>
      <clipPath id="${clipId}">
        <rect x="${clipBounds.x}" y="${clipBounds.y}" width="${clipBounds.width}" height="${clipBounds.height}" />
      </clipPath>
    </defs>
    <g opacity="${light.toFixed(3)}">
      <animateTransform attributeName="transform" type="translate" begin="${bobBegin}" dur="1700ms" values="0 0;0 -${bobOffset};0 0" keyTimes="0;0.5;1" repeatCount="indefinite" />
      <image href="${escapeXml(textureUri)}" x="${currentBounds.x}" y="${currentBounds.y}" width="${currentBounds.width}" height="${currentBounds.height}" preserveAspectRatio="xMidYMax meet" clip-path="url(#${clipId})" image-rendering="pixelated" style="image-rendering: pixelated; image-rendering: crisp-edges;">
        ${movementMarkup}
      </image>
    </g>`);
  }

  return pieces.join("\n");
}

function createRaycastFrame(state) {
  const camera = getCamera(state);
  const textureLookup = createTextureLookup(state);
  const rays = [];
  const zBuffer = new Array(VIEWPORT_RENDER_BOX.internalWidth);
  const textureUris = new Set();

  for (let column = 0; column < VIEWPORT_RENDER_BOX.internalWidth; column += 1) {
    const ray = castRay(state, camera, column);
    rays.push(ray);
    zBuffer[column] = ray.distance;
    const wallTextureUri = textureLookup.surface("wall", ray.cellX, ray.cellY);
    if (wallTextureUri) {
      textureUris.add(wallTextureUri);
    }
  }

  // One pass builds the floor and ceiling patches, so the defs and the markup can never disagree.
  const floorSamples = collectFloorSamples(camera, textureLookup);
  for (const sample of floorSamples) {
    textureUris.add(sample.textureUri);
  }

  const frame = {
    camera,
    zBuffer
  };
  const sceneMarkup = `${renderFloorSamples(floorSamples)}
${renderWalls(rays, textureLookup)}`;
  const enemyMarkup = renderEnemies(state, frame, textureLookup);

  return {
    ...frame,
    sceneMarkup,
    enemyMarkup,
    textureUris,
    markup: `${sceneMarkup}
${enemyMarkup}`
  };
}

function projectBillboardBounds(frame, cellX, cellY, options = {}) {
  const projection = projectBillboard(
    frame,
    cellX + 0.5,
    cellY + 0.5,
    options.widthScale || 1,
    options.heightScale || options.widthScale || 1
  );

  if (!projection) {
    return null;
  }

  return {
    x: VIEWPORT_RENDER_BOX.x + (projection.startX * VIEWPORT_RENDER_BOX.pixelWidth),
    y: VIEWPORT_RENDER_BOX.y + (projection.startY * VIEWPORT_RENDER_BOX.pixelHeight),
    width: Math.max(
      VIEWPORT_RENDER_BOX.pixelWidth,
      (projection.endX - projection.startX + 1) * VIEWPORT_RENDER_BOX.pixelWidth
    ),
    height: Math.max(
      VIEWPORT_RENDER_BOX.pixelHeight,
      (projection.endY - projection.startY + 1) * VIEWPORT_RENDER_BOX.pixelHeight
    ),
    distance: projection.distance
  };
}

module.exports = {
  VIEWPORT_RENDER_BOX,
  createRaycastFrame,
  projectBillboardBounds
};
