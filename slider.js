function createCustomSlider(range, min, max, initialValue, onChangeCallback) {
  range.type = "range";
  range.min = min;
  range.max = max;
  range.value = initialValue;
  range.style.width = "100%";
  range.style.appearance = "none";
  range.style.height = "12px";
  range.style.borderRadius = "6px";
  range.style.background = "#ddd";
  range.style.outline = "none";
  range.style.marginBottom = "10px";
  range.style.transform = "rotate(270deg)";
  // Custom thumb style
  range.style.setProperty("--thumb-size", "32px");

  range.addEventListener("input", () => {
    if (onChangeCallback) onChangeCallback(Number(range.value));
  });

  //wrapper.appendChild(range);
  //container.appendChild(wrapper);
  //container.appendChild(range);
}
