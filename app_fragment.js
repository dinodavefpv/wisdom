    function updateModalView() {
        if (isEditing) {
            overlay.classList.add('editing');
            viewDiv.style.display = 'none';
            hintDiv.style.display = 'none';
            textarea.classList.remove('hidden');
            actionsDiv.classList.remove('hidden');
            textarea.focus();
        } else {
            overlay.classList.remove('editing');
            textarea.value = dose.notes; // Reset changes
            viewDiv.textContent = dose.notes;
            textarea.classList.add('hidden');
            actionsDiv.classList.add('hidden');
            viewDiv.style.display = 'block';
            hintDiv.style.display = 'block';
            viewDiv.classList.remove('hidden');
            hintDiv.classList.remove('hidden');
        }
    }