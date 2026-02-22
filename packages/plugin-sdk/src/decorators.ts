export function Action(config: { name: string; description: string }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor._actions) {
      target.constructor._actions = [];
    }
    target.constructor._actions.push({
      name: config.name,
      description: config.description,
      method: propertyKey,
    });
  };
}

export function Trigger(config: { type: string; schedule?: string }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor._triggers) {
      target.constructor._triggers = [];
    }
    target.constructor._triggers.push({
      type: config.type,
      schedule: config.schedule,
      method: propertyKey,
    });
  };
}

export function Hook(event: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor._hooks) {
      target.constructor._hooks = [];
    }
    target.constructor._hooks.push({
      event,
      method: propertyKey,
    });
  };
}