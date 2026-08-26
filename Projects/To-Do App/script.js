document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn');
    const taskList = document.getElementById('task-list');

    // Function to add a new task
    function addTask() {
        const taskText = taskInput.value.trim();
        
        if (taskText === '') {
            alert('Please enter a task.');
            return;
        }

        // Create the list item
        const li = document.createElement('li');
        li.className = 'task-item';

        // Create a span for the text to separate it from the delete button
        const textSpan = document.createElement('span');
        textSpan.textContent = taskText;

        // Create the delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete task';
        
        // Add event listener to delete button
        deleteBtn.addEventListener('click', function() {
            li.remove();
        });

        // Append text and button to the list item
        li.appendChild(textSpan);
        li.appendChild(deleteBtn);

        // Append the list item to the ordered list
        taskList.appendChild(li);

        // Clear the input field
        taskInput.value = '';
        taskInput.focus();
    }

    // Event listener for the Add button
    addBtn.addEventListener('click', addTask);

    // Allow pressing "Enter" to add a task
    taskInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTask();
        }
    });
});
