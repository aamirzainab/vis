import {getScene} from "./script.js" 


document.getElementById('right-toolbar').addEventListener('change', async function(event) {
  const target = event.target;
  if (target.tagName === 'INPUT' && target.type === 'checkbox') {
      const isChecked = target.checked;
      
      // If the checkbox is for a folder, set all children's checked state to match
      if (isFolderCheckbox(target)) {
          const childCheckboxes = getChildCheckboxes(target);
          for (let checkbox of childCheckboxes) {
              checkbox.checked = isChecked; 
              await handleChangeOnModel(checkbox);
          }
      } else {
          await handleChangeOnModel(target);
      }
  }
});

async function handleChangeOnModel(checkbox) {
  const modelPath = getModelPath(checkbox);
  const isChecked = checkbox.checked;
  console.log(`Model selected: ${modelPath}, Checked: ${isChecked}`);
  const scene = getScene();
  const existingObject = scene.getObjectByName(modelPath);
  if (existingObject) {
    if (isChecked) {
      existingObject.visible = true ; 

    } else {
        existingObject.visible = false ; 
    }
  }
}

function isFolderCheckbox(checkbox) {
  return checkbox.parentElement.querySelector('ul') !== null;
}

function getChildCheckboxes(checkbox) {
  let childCheckboxes = [];
  const nextElements = checkbox.parentElement.querySelectorAll('input[type="checkbox"]');
  childCheckboxes = Array.from(nextElements);
  return childCheckboxes;
}


function getModelPath(checkbox) {
  let pathComponents = [];
  let currentElement = checkbox;

  // Climb up the DOM tree to build the path
  while (currentElement && currentElement.id !== 'right-toolbar') {
      if (currentElement.tagName === 'LI' && currentElement.querySelector('label')) {
          const label = currentElement.querySelector('label').textContent.trim();
          if (label) pathComponents.unshift(label); // Add to the beginning of the array
      }
      currentElement = currentElement.parentNode;
  }

  // Join the path components
  return pathComponents.join('/');
}

