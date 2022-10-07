const DOTTED = 10;

Hooks.once('init', async () => {
  console.log('dotted-grid | Initializing dotted-grid');

  // 🦧🦧🦧 🐒🐒🐒 🐵🐵🐵
  //     Start monke
  // 🦧🦧🦧 🐒🐒🐒 🐵🐵🐵

  // Handle the fetching of the Grid implementation. We check if the current scene has a dotted flag and is square
  const baseGrid_implementationFor = BaseGrid.implementationFor;
  BaseGrid.implementationFor = function (gridType) {
    if (gridType === CONST.GRID_TYPES.SQUARE && canvas?.scene?.getFlag('dotted-grid', 'isDotted')) return DottedGrid;
    return baseGrid_implementationFor(gridType);
  };

  // Used in enumerating the options for the grid. Basically add another option
  const sceneConfig_getGridTypes = SceneConfig._getGridTypes;
  SceneConfig._getGridTypes = function () {
    const x = sceneConfig_getGridTypes();
    return {
      ...x,
      [DOTTED]: 'SCENES.GridDotted',
    };
  };

  // SceneConfig update handling (from form to document)
  const sceneConfig_updateObject = SceneConfig.prototype._updateObject;
  SceneConfig.prototype._updateObject = async function (event, formData) {
    // Get the grid type from form, then set it to SQUARE
    // Note: this is required since it's not possible to GRID_TYPES take only numbers in [0, 5]
    // If we give any other number, the backend complains, and it's not possible to reason with the backend (other than trick it)
    const gridType = formData['grid.type'];
    if (gridType === DOTTED) {
      formData['grid.type'] = CONST.GRID_TYPES.SQUARE;
    }

    // Call the default update
    const update = await sceneConfig_updateObject.call(this, event, formData);

    // If we are setting a dotted grid, add a flag (or remove it otherwise)
    // Also force re-rendering of the grid when switching between dotted and not (required due to grid.type not changing)
    const isCurrentlyDotted = this.document?.getFlag('dotted-grid', 'isDotted');
    if (gridType === DOTTED) {
      await this.document.setFlag('dotted-grid', 'isDotted', true);
      if (!isCurrentlyDotted && canvas.scene === this.document) return canvas.draw();
    } else {
      await this.document.setFlag('dotted-grid', 'isDotted', false);
      if (isCurrentlyDotted && canvas.scene === this.document) return canvas.draw();
    }

    return update;
  };

  // 🦧🦧🦧 🐒🐒🐒 🐵🐵🐵
  //     End monke
  // 🦧🦧🦧 🐒🐒🐒 🐵🐵🐵

  // Add an hidden setting if users really want to change the radius
  game.dottedGrid = {
    setRadius: (r) => game.settings.set('dotted-grid', 'radius', r),
  };

  game.settings.register('dotted-grid', 'radius', {
    name: 'radius',
    hint: '',
    scope: 'world',
    config: false,
    requiresReload: false,
    type: Number,
    default: 3,
    onChange: () => canvas?.draw(),
  });
});

// [fix eslint]
/* global PIXI */

// Mapping between performance mode and antialiasing quality
const MULTISAMPLING_PERFORMANCE = {
  [CONST.CANVAS_PERFORMANCE_MODES.LOW]: [PIXI.MSAA_QUALITY.NONE],
  [CONST.CANVAS_PERFORMANCE_MODES.MED]: [PIXI.MSAA_QUALITY.LOW],
  [CONST.CANVAS_PERFORMANCE_MODES.HIGH]: [PIXI.MSAA_QUALITY.MEDIUM],
  [CONST.CANVAS_PERFORMANCE_MODES.MAX]: [PIXI.MSAA_QUALITY.HIGH],
};

/**
 * The grid class
 */
class DottedGrid extends SquareGrid {
  constructor(...args) {
    super(...args);
    // Determine multisampling strategy at creation time
    const performanceMode = game.settings.get('core', 'performanceMode');
    this.multisample = MULTISAMPLING_PERFORMANCE[performanceMode];
    this.radius = game.settings.get('dotted-grid', 'radius');
  }

  /**
   * @override
   * @param options
   * @returns {DottedGrid}
   */
  draw(options = {}) {
    BaseGrid.prototype.draw.call(this, options);
    let { color, alpha, dimensions } = foundry.utils.mergeObject(this.options, options);
    if (alpha === 0) return this;

    // Set dimensions
    this.width = dimensions.width;
    this.height = dimensions.height;

    // Add a container for the dots
    const dots = new PIXI.Graphics();
    dots.beginFill(color, alpha);
    this.addChild(dots);

    // Draw the dots
    const r = this.radius;
    for (let x = 0; x <= dimensions.width; x += dimensions.size) {
      for (let y = 0; y <= dimensions.height; y += dimensions.size) {
        dots.drawCircle(x, y, r);
      }
    }

    // End the fill, add FXAA and return
    dots.endFill();
    const fxaa = new PIXI.filters.FXAAFilter();
    fxaa.multisample = this.multisample;
    dots.filters = [fxaa];
    return this;
  }
}

/**
 * Inject the "Dotted" selection if the grid being configured has the flag
 */
Hooks.on('renderSceneConfig', (sceneConfig, element, options) => {
  if (!options.document?.getFlag('dotted-grid', 'isDotted')) return;
  const select = element.find('select[name="grid.type"]');
  select.val(DOTTED);
});
