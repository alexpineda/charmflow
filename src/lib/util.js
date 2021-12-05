const {
    Constants,
  } = require("eris");

  
const _disableMessageComponents = (components) => {
    return components.map((component) =>
      component.type === Constants.ComponentTypes.ACTION_ROW
        ? {
            ...component,
            components: _disableMessageComponents(component.components),
          }
        : {
            ...component,
            disabled: true,
          }
    );
  }
  
  const disableMessageComponents = async (message) => {
    if (message.components.length === 0) {
      return;
    }
  
    const c = {
      ...message,
      components: _disableMessageComponents(message.components),
    };
    await message.edit(c);
  }

module.exports = {
    disableMessageComponents
}