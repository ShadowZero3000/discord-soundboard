function parseFailure(jqXHR, status, error) {
  $("#error-message-holder").html(`<b>${status}</b>: ${jqXHR.responseText}`);
  $("#error-display").modal('show');
}

function play(clip) {
  axios.get(`api/play/${clip}`)
}

function random(clip) {
  axios.get(`api/random/${clip}`)
}

Vue.component('search-box', {
  data: function() {
    return {
      searchResults: null,
      searching: false,
      searchQuery: null,
      isTyping: false
    }
  },
  props: {
    clips: Object
  },
  watch: {
    searchQuery: _.debounce(function() {
      this.isTyping = false;
    }, 500),
    isTyping: function(value) {
      if (!value) {
        this.find(value)
      }
    }
  },
  methods: {
    find: function(value) {
      if(this.searchQuery == "" || this.searchQuery.length == 1) {
        this.searching = false
        return
      }
      var searchString = this.searchQuery
                            .replace(' ','[_-]*')
                            .replace(/[^A-z0-9_\-\*]/g,'')
      var clipList = []
      var data = this.clips.data
      var regex = new RegExp(`.*${searchString}.*`, 'i')
      Object.keys(data).forEach(function(category) {
        var cat = data[category];
        Object.keys(cat).forEach(function(subcategory) {
          var subcat = cat[subcategory];
          Object.keys(subcat).forEach(function(clip) {
            if(clip.match(regex)) {
              clipList.push(clip)
            }
          });
        });
      });
      this.searchResults = clipList.sort();
      if(this.searchResults.length > 0) {
        this.searching = true;
      } else {
        this.searching = false;
      }
    },
    toTitleCase(str) {
      return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }
  }
})
new Vue({
  el: '#vuewrapper',
  data () {
    return {
      clips: { data: null },
      category: null,
      subcategory: null,
      sounds: null,
      loaded: false
    }
  },
  mounted () {
    axios
      .get('//'+window.location.host+'/api/clips')
      .then(response => {this.clips = response; this.loaded = true})
  },
  methods: {
    toTitleCase(str) {
      return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }
  }
})

// NOTE: We probably want to use window.location.hostname + some port later

