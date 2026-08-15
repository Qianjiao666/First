export function capabilityKey(resource, action) {
  return `${resource}:${action}`;
}

export function hasCapability(capabilities, resource, action) {
  return Array.isArray(capabilities) && capabilities.includes(capabilityKey(resource, action));
}

export async function getCapabilities() {
  return window.MKJApp?.getCapabilities?.() ?? [];
}

export function applyCapabilityVisibility(root, capabilities) {
  root.querySelectorAll("[data-mkj-capability]").forEach((element) => {
    const [resource, action] = element.dataset.mkjCapability.split(":");
    element.hidden = !hasCapability(capabilities, resource, action);
  });
}
