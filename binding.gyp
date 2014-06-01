{
  "targets": [
    {
      "target_name": "backport",
      "sources": [ "src/backport.cc" ],
      "include_dirs" : [
        "<!(node -e \"require('nan')\")"
      ]
    }
  ]
}
