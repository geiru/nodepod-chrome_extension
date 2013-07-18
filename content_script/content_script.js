$('body').on('click', function(event) {
    // TODO send tag name etc.
    var attributes = event.target.attributes,
        index, attribute,
        element;

    element = {};
    for(index in attributes) {
        element[attributes[index]['name']] = attributes[index]['value'];
    }

    chrome.extension.sendMessage({message: 'click', element: element}, function(response) {});
});
