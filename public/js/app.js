function parseFailure(error) {
  vm.showModal(error.response.data)
}

function play(clip) {
  axios.get(`api/play/${clip}`)
    .catch(parseFailure)
}

function random(clip) {
  axios.get(`api/random/${clip}`)
    .catch(parseFailure)
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
              clipList.push({"name": clip, "subcategory": subcategory, "category": category})
            }
          });
        });
      });
      this.searchResults = _.sortBy(clipList, "name");
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
    },
    mouseOver(clip) {
      return clip.category
    }
  }
})
var vm = new Vue({
  el: '#vuewrapper',
  data () {
    return {
      clips: { data: null },
      category: null,
      subcategory: null,
      sounds: null,
      errorMessage: null,
      randomClips: ['wow']
    }
  },
  mounted () {
    this.refreshData()
  },
  methods: {
    refreshData() {
      axios
        .get('//'+window.location.host+'/api/clips')
        .then(response => {this.clips = response.data})
      axios
        .get('//'+window.location.host+'/api/clips/random')
        .then(response => {this.randomClips = response.data})
    },
    toTitleCase(str) {
      return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    },
    showModal(str) {
      this.errorMessage = str
      this.$refs.errorModal.show()
    }
  }
})

// NOTE: We probably want to use window.location.hostname + some port later

